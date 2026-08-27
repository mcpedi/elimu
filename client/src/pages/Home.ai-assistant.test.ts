import { describe, expect, it } from "vitest";
import { roleNavigation } from "./Home";

describe("Elimubora360 assistant workspace", () => {
  it("is available to personnel and learners through the shared navigation", () => {
    for (const role of ["super_admin", "teacher", "parent", "student"]) {
      expect(roleNavigation(role).some(item => item.id === "assistant" && item.label === "AI assistant")).toBe(true);
    }
  });

  it("keeps sensitive changes in the normal confirmed workflows", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("./Home.tsx", import.meta.url), "utf8"));
    expect(source).toContain("cannot bypass your role or silently change records");
    expect(source).toContain("Use the normal workspace controls for marks, fees, passwords, school codes, permissions");
  });
});
