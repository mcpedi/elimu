import { describe, expect, it } from "vitest";
import { learnerLoginInstructionsPrintable } from "./Home";

describe("learner login instruction sheet", () => {
  it("includes escaped school access details and safe guidance without a password", () => {
    const html = learnerLoginInstructionsPrintable({ name: "Nyota <School>", code: "NYOTA-01", email: "office@example.com" }, "https://school.example");
    expect(html).toContain("NYOTA-01");
    expect(html).toContain("https://school.example");
    expect(html).toContain("Enter your admission number as your initial password");
    expect(html).toContain("Keep your access details private");
    expect(html).toContain("Nyota &lt;School&gt;");
    expect(html).not.toContain("studentPassword");
  });
});
