import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const configPath = new URL("../neon.ts", import.meta.url);

describe("Neon project configuration", () => {
  it("uses the requested Postgres config v1 entrypoint", async () => {
    const source = await readFile(configPath, "utf8");
    expect(source).toContain('from "@neon/config/v1"');
    expect(source).toContain("defineConfig({})");
  });
});
