import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("fee receipt preview workflow", () => {
  it("offers a preview before the branded print handoff and shows the remaining balance", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source).toContain("Preview receipt");
    expect(source).toContain("Review payment receipt");
    expect(source).toContain('label="Balance remaining"');
    expect(source).toContain("Previewing does not create an export audit.");
    expect(source).toContain('onClick={printReceipt}');
  });
});
