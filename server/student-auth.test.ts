import { describe, expect, it } from "vitest";
import { hashStudentSecret, normalizeStudentIdentifier, verifyStudentSecret } from "./student-auth";

describe("student credential helpers", () => {
  it("normalizes admission identifiers consistently", () => {
    expect(normalizeStudentIdentifier("  adm-0042 ")).toBe("ADM-0042");
  });

  it("hashes secrets with a salted scrypt record and rejects wrong values", async () => {
    const encoded = await hashStudentSecret("LearnerPass42");
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]+\$[a-f0-9]+$/);
    expect(await verifyStudentSecret("LearnerPass42", encoded)).toBe(true);
    expect(await verifyStudentSecret("WrongPass42", encoded)).toBe(false);
    expect(await verifyStudentSecret("LearnerPass42", null)).toBe(false);
  });
});
