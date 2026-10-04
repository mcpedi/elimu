import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Super Administrator setup page", () => {
  it("is registered as a dedicated route", async () => {
    const source = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    expect(source).toContain('path={"/setup/super-admin"}');
    expect(source).toContain("SuperAdminSetup");
  });

  it("requires a one-time code and confirmed private password", async () => {
    const source = await readFile(new URL("./SuperAdminSetup.tsx", import.meta.url), "utf8");
    expect(source).toContain("completeSuperAdminSetup");
    expect(source).toContain("super-admin-setup-code");
    expect(source).toContain("super-admin-password");
    expect(source).toContain("super-admin-confirm-password");
    expect(source).toContain("The setup code is consumed immediately");
  });
});
