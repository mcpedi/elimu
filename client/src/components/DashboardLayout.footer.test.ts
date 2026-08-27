import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Dashboard footer credit", () => {
  it("renders the requested designer credit in an accessible footer", async () => {
    const source = await readFile(new URL("./DashboardLayout.tsx", import.meta.url), "utf8");
    expect(source).toContain("Designed by Jacks Webs Solutions");
    expect(source).toContain('aria-label="System designer credit"');
    expect(source).toContain("text-center");
  });
});
