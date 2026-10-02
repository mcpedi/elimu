import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { Client } from "pg";
import { parse as parseDotenv } from "dotenv";

type SourceColumn = {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  DATA_TYPE: string;
  IS_NULLABLE: "YES" | "NO";
  COLUMN_DEFAULT: string | null;
  EXTRA: string;
  ORDINAL_POSITION: number;
  NUMERIC_PRECISION: number | null;
  NUMERIC_SCALE: number | null;
  CHARACTER_MAXIMUM_LENGTH: number | null;
};

type SourceTable = { TABLE_NAME: string };
type SourceIndex = { INDEX_NAME: string; NON_UNIQUE: number; SEQ_IN_INDEX: number; COLUMN_NAME: string };
type SourceForeignKey = {
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
  ORDINAL_POSITION: number;
  UPDATE_RULE: string;
  DELETE_RULE: string;
};

type TableMeta = {
  name: string;
  columns: SourceColumn[];
  indexes: SourceIndex[];
  foreignKeys: SourceForeignKey[];
};

const SYSTEM_TABLES = new Set(["__drizzle_migrations"]);
const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
const envLocalPath = resolve(process.cwd(), ".env.local");
const envLocal = parseDotenv(readFileSync(envLocalPath, "utf8"));
const targetUrl = process.env.NEON_DATABASE_URL ?? envLocal.DATABASE_URL;
const isDryRun = process.argv.includes("--dry-run");

if (!sourceUrl) throw new Error("Source DATABASE_URL is not available.");
if (!targetUrl) throw new Error("Neon target DATABASE_URL is not available in .env.local.");
if (sourceUrl === targetUrl) throw new Error("Source and target database URLs must be different.");

function quoteIdent(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteMysqlIdent(value: string) {
  return `\`${value.replaceAll("`", "``")}\``;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function qualifiedTable(name: string) {
  return `${quoteIdent("public")}.${quoteIdent(name)}`;
}

function mapType(column: SourceColumn) {
  const type = column.COLUMN_TYPE.toLowerCase();
  const dataType = column.DATA_TYPE.toLowerCase();
  if (dataType === "tinyint" && /tinyint\\(1\\)/.test(type)) return "boolean";
  if (dataType === "bigint") return "bigint";
  if (["int", "integer", "mediumint"].includes(dataType)) return "integer";
  if (dataType === "smallint") return "smallint";
  if (dataType === "tinyint") return "smallint";
  if (dataType === "decimal" || dataType === "numeric") {
    return column.NUMERIC_PRECISION && column.NUMERIC_SCALE != null
      ? `numeric(${column.NUMERIC_PRECISION},${column.NUMERIC_SCALE})`
      : "numeric";
  }
  if (dataType === "double") return "double precision";
  if (dataType === "float") return "real";
  if (dataType === "date") return "date";
  if (["datetime", "timestamp"].includes(dataType)) return "timestamp without time zone";
  if (dataType === "time") return "time without time zone";
  if (dataType === "year") return "integer";
  if (dataType === "json") return "jsonb";
  if (["blob", "tinyblob", "mediumblob", "longblob", "binary", "varbinary"].includes(dataType)) return "bytea";
  if (dataType === "char" && column.CHARACTER_MAXIMUM_LENGTH) return `varchar(${column.CHARACTER_MAXIMUM_LENGTH})`;
  if (dataType === "varchar" && column.CHARACTER_MAXIMUM_LENGTH) return `varchar(${column.CHARACTER_MAXIMUM_LENGTH})`;
  return "text";
}

function mapDefault(column: SourceColumn) {
  if (column.COLUMN_DEFAULT == null) return "";
  const value = String(column.COLUMN_DEFAULT);
  const targetType = mapType(column);
  if (/^current_timestamp(?:\\(\\))?$/i.test(value)) return " DEFAULT CURRENT_TIMESTAMP";
  if (targetType === "boolean" && value === "0") return " DEFAULT FALSE";
  if (targetType === "boolean" && value === "1") return " DEFAULT TRUE";
  if (/^-?\\d+(?:\\.\\d+)?$/.test(value) && !["text", "jsonb", "bytea"].includes(targetType)) return ` DEFAULT ${value}`;
  return ` DEFAULT ${quoteLiteral(value.replace(/^'(.*)'$/, "$1"))}`;
}

function normalizeValue(value: unknown, column: SourceColumn) {
  if (value == null) return null;
  const targetType = mapType(column);
  if (targetType === "boolean") return Boolean(Number(value));
  if (targetType === "jsonb" && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return JSON.stringify(value);
    }
  }
  if (targetType === "jsonb" && Buffer.isBuffer(value)) {
    const text = value.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return JSON.stringify(text);
    }
  }
  if (targetType === "jsonb" && typeof value === "object") return JSON.stringify(value);
  return value;
}

function getInsertOrder(tables: TableMeta[]) {
  const names = new Set(tables.map(table => table.name));
  const dependencies = new Map<string, Set<string>>(
    tables.map(table => [table.name, new Set(table.foreignKeys.map(key => key.REFERENCED_TABLE_NAME).filter(name => names.has(name)))])
  );
  const result: string[] = [];
  while (dependencies.size) {
    const ready = [...dependencies.entries()].filter(([, deps]) => deps.size === 0).map(([name]) => name).sort();
    if (!ready.length) {
      result.push(...[...dependencies.keys()].sort());
      break;
    }
    for (const name of ready) {
      result.push(name);
      dependencies.delete(name);
      for (const deps of dependencies.values()) deps.delete(name);
    }
  }
  return result;
}

async function loadMetadata(source: mysql.Connection) {
  const [tableRows] = await source.query<SourceTable[]>(
    "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  const tableNames = tableRows.map(row => row.TABLE_NAME).filter(name => !SYSTEM_TABLES.has(name));
  const metas: TableMeta[] = [];
  for (const name of tableNames) {
    const [columns] = await source.query<SourceColumn[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, ORDINAL_POSITION, NUMERIC_PRECISION, NUMERIC_SCALE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ORDINAL_POSITION`,
      [name]
    );
    const [indexes] = await source.query<SourceIndex[]>(
      `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [name]
    );
    const [foreignKeys] = await source.query<SourceForeignKey[]>(
      `SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, kcu.ORDINAL_POSITION, rc.UPDATE_RULE, rc.DELETE_RULE FROM information_schema.key_column_usage kcu JOIN information_schema.referential_constraints rc ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND rc.TABLE_NAME = kcu.TABLE_NAME WHERE kcu.TABLE_SCHEMA = DATABASE() AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
      [name]
    );
    metas.push({ name, columns, indexes, foreignKeys });
  }
  return metas;
}

function createTableSql(table: TableMeta) {
  const primaryColumns = table.indexes.filter(index => index.INDEX_NAME === "PRIMARY").sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX).map(index => quoteIdent(index.COLUMN_NAME));
  const definitions = table.columns.map(column => {
    const identity = /auto_increment/i.test(column.EXTRA) ? " GENERATED BY DEFAULT AS IDENTITY" : "";
    const nullable = column.IS_NULLABLE === "NO" ? " NOT NULL" : "";
    return `${quoteIdent(column.COLUMN_NAME)} ${mapType(column)}${identity}${nullable}${mapDefault(column)}`;
  });
  if (primaryColumns.length) definitions.push(`PRIMARY KEY (${primaryColumns.join(", ")})`);
  return `CREATE TABLE ${qualifiedTable(table.name)} (${definitions.join(", ")})`;
}

function indexGroups(table: TableMeta) {
  const groups = new Map<string, SourceIndex[]>();
  for (const index of table.indexes) {
    if (index.INDEX_NAME === "PRIMARY") continue;
    const group = groups.get(index.INDEX_NAME) ?? [];
    group.push(index);
    groups.set(index.INDEX_NAME, group);
  }
  return groups;
}

async function assertTargetEmpty(target: Client) {
  const result = await target.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
  const tables = result.rows.map(row => row.table_name).filter(name => !SYSTEM_TABLES.has(name));
  if (tables.length) throw new Error(`Refusing to migrate into non-empty Neon database. Existing tables: ${tables.join(", ")}`);
}

async function main() {
  const source = await mysql.createConnection(sourceUrl);
  const target = new Client({ connectionString: targetUrl });
  await target.connect();
  try {
    const tables = await loadMetadata(source);
    const counts: Array<{ table: string; rows: number }> = [];
    for (const table of tables) {
      const [rows] = await source.query<unknown[]>(`SELECT * FROM ${quoteMysqlIdent(table.name)}`);
      counts.push({ table: table.name, rows: rows.length });
    }
    console.log(JSON.stringify({ sourceTables: tables.length, sourceRows: counts.reduce((sum, item) => sum + item.rows, 0), counts }, null, 2));
    if (isDryRun) return;

    await assertTargetEmpty(target);
    await target.query("BEGIN");
    for (const table of tables) await target.query(createTableSql(table));

    const tablesByName = new Map(tables.map(table => [table.name, table]));
    for (const tableName of getInsertOrder(tables)) {
      const table = tablesByName.get(tableName)!;
      const [rows] = await source.query<Record<string, unknown>[]>(`SELECT * FROM ${quoteMysqlIdent(table.name)}`);
      if (!rows.length) continue;
      const columns = table.columns.map(column => column.COLUMN_NAME);
      const values = rows.flatMap(row => columns.map(columnName => normalizeValue(row[columnName], table.columns.find(column => column.COLUMN_NAME === columnName)!)));
      const placeholders = rows.map((_, rowIndex) => `(${columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(", ")})`).join(", ");
      try {
        await target.query(`INSERT INTO ${qualifiedTable(table.name)} (${columns.map(quoteIdent).join(", ")}) VALUES ${placeholders}`, values);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const jsonColumns = table.columns.filter(column => mapType(column) === "jsonb").map(column => column.COLUMN_NAME);
        throw new Error(`Failed inserting ${table.name} (${rows.length} rows; JSON columns: ${jsonColumns.join(", ") || "none"}): ${detail}`);
      }
    }

    for (const table of tables) {
      for (const [indexName, indexes] of indexGroups(table)) {
        const columns = indexes.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX).map(index => quoteIdent(index.COLUMN_NAME)).join(", ");
        const unique = indexes[0].NON_UNIQUE === 0 ? "UNIQUE " : "";
        await target.query(`CREATE ${unique}INDEX ${quoteIdent(indexName)} ON ${qualifiedTable(table.name)} (${columns})`);
      }
    }

    const foreignKeyGroups = new Map<string, SourceForeignKey[]>();
    for (const table of tables) {
      for (const foreignKey of table.foreignKeys) {
        const key = `${table.name}:${foreignKey.CONSTRAINT_NAME}`;
        const group = foreignKeyGroups.get(key) ?? [];
        group.push(foreignKey);
        foreignKeyGroups.set(key, group);
      }
    }
    for (const [key, keys] of foreignKeyGroups) {
      const [tableName, constraintName] = key.split(":");
      const columns = keys.sort((a, b) => a.ORDINAL_POSITION - b.ORDINAL_POSITION).map(item => quoteIdent(item.COLUMN_NAME)).join(", ");
      const referencedColumns = keys.sort((a, b) => a.ORDINAL_POSITION - b.ORDINAL_POSITION).map(item => quoteIdent(item.REFERENCED_COLUMN_NAME)).join(", ");
      const referencedTable = keys[0].REFERENCED_TABLE_NAME;
      const updateRule = keys[0].UPDATE_RULE === "NO ACTION" ? "NO ACTION" : keys[0].UPDATE_RULE;
      const deleteRule = keys[0].DELETE_RULE === "NO ACTION" ? "NO ACTION" : keys[0].DELETE_RULE;
      await target.query(`ALTER TABLE ${qualifiedTable(tableName)} ADD CONSTRAINT ${quoteIdent(constraintName)} FOREIGN KEY (${columns}) REFERENCES ${qualifiedTable(referencedTable)} (${referencedColumns}) ON UPDATE ${updateRule} ON DELETE ${deleteRule}`);
    }

    for (const table of tables) {
      const idColumn = table.columns.find(column => column.COLUMN_NAME === "id" && /auto_increment/i.test(column.EXTRA));
      if (!idColumn) continue;
      const sequenceResult = await target.query<{ sequence_name: string | null }>("SELECT pg_get_serial_sequence($1, $2) AS sequence_name", [`public.${quoteIdent(table.name)}`, idColumn.COLUMN_NAME]);
      const sequenceName = sequenceResult.rows[0]?.sequence_name;
      if (!sequenceName) continue;
      await target.query(`SELECT setval($1, COALESCE((SELECT MAX(${quoteIdent(idColumn.COLUMN_NAME)}) FROM ${qualifiedTable(table.name)}), 1), (SELECT COUNT(*) > 0 FROM ${qualifiedTable(table.name)}))`, [sequenceName]);
    }

    await target.query("COMMIT");
    console.log(`Migrated ${tables.length} tables and ${counts.reduce((sum, item) => sum + item.rows, 0)} rows into Neon production.`);
  } catch (error) {
    await target.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
