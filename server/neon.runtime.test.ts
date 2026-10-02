import { describe, expect, it } from "vitest";
import { Client } from "pg";

describe("Neon runtime database", () => {
  it("connects to the configured production database read-only", async () => {
    const connectionString = process.env.NEON_DATABASE_URL;
    expect(connectionString, "NEON_DATABASE_URL must be provided by the project secret manager").toBeTruthy();

    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query<{ database: string; schema: string }>(
        "SELECT current_database() AS database, current_schema() AS schema"
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.schema).toBe("public");
      expect(result.rows[0]?.database).toBeTruthy();
    } finally {
      await client.end();
    }
  }, 20_000);
});
