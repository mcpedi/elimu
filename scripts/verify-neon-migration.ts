import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { Client } from "pg";
import { parse as parseDotenv } from "dotenv";
import { createHash } from "node:crypto";

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
const envLocal = parseDotenv(readFileSync(resolve(process.cwd(), ".env.local"), "utf8"));
const targetUrl = process.env.NEON_DATABASE_URL ?? envLocal.DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("Both source and target database URLs are required.");
if (sourceUrl === targetUrl) throw new Error("Source and target database URLs must be different.");

function mysqlIdent(value: string) {
  return `\`${value.replaceAll("`", "``")}\``;
}
function pgIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `buffer:${value.toString("hex")}`;
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  if (typeof value === "number") return String(value);
  return value;
}
function fingerprint(rows: Record<string, unknown>[]) {
  const normalized = rows.map(row => stable(row));
  normalized.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function main() {
  const source = await mysql.createConnection(sourceUrl);
  const target = new Client({ connectionString: targetUrl });
  await target.connect();
  try {
    const [sourceTables] = await source.query<{ TABLE_NAME: string }[]>("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '__drizzle_migrations' ORDER BY TABLE_NAME");
    const targetTables = (await target.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")).rows.filter(row => row.table_name !== "__drizzle_migrations");
    const sourceNames = sourceTables.map(row => row.TABLE_NAME);
    const targetNames = targetTables.map(row => row.table_name);
    if (JSON.stringify(sourceNames) !== JSON.stringify(targetNames)) throw new Error(`Table mismatch. Source=${sourceNames.join(",")} Target=${targetNames.join(",")}`);

    const results: Array<{ table: string; rows: number; fingerprint: string }> = [];
    for (const tableName of sourceNames) {
      const [sourceColumns] = await source.query<{ COLUMN_NAME: string }[]>("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION", [tableName]);
      const targetColumns = (await target.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [tableName])).rows;
      const sourceColumnNames = sourceColumns.map(row => row.COLUMN_NAME);
      const targetColumnNames = targetColumns.map(row => row.column_name);
      if (JSON.stringify(sourceColumnNames) !== JSON.stringify(targetColumnNames)) throw new Error(`Column mismatch in ${tableName}. Source=${sourceColumnNames.join(",")} Target=${targetColumnNames.join(",")}`);

      const [sourceRows] = await source.query<Record<string, unknown>[]>(`SELECT * FROM ${mysqlIdent(tableName)}`);
      const targetRows = (await target.query<Record<string, unknown>>(`SELECT * FROM public.${pgIdent(tableName)}`)).rows;
      if (sourceRows.length !== targetRows.length) throw new Error(`Row-count mismatch in ${tableName}: source=${sourceRows.length} target=${targetRows.length}`);
      const sourceFingerprint = fingerprint(sourceRows);
      const targetFingerprint = fingerprint(targetRows);
      if (sourceFingerprint !== targetFingerprint) throw new Error(`Data fingerprint mismatch in ${tableName}: source=${sourceFingerprint} target=${targetFingerprint}`);
      results.push({ table: tableName, rows: sourceRows.length, fingerprint: sourceFingerprint });
    }

    const sourceTotal = results.reduce((sum, result) => sum + result.rows, 0);
    const targetForeignKeys = (await target.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM pg_constraint WHERE contype = 'f'")).rows[0]?.count ?? "0";
    console.log(JSON.stringify({ verifiedTables: results.length, verifiedRows: sourceTotal, targetForeignKeys: Number(targetForeignKeys), results }, null, 2));
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
