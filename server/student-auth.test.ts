import { describe, expect, it } from "vitest";
import { hashStudentSecret, normalizeStudentIdentifier, normalizeStudentUsername, normalizeStudentUsernameInput, verifyStudentSecret } from "./student-auth";

describe("student credential helpers", () => {
  it("normalizes admission identifiers consistently", () => {
    expect(normalizeStudentIdentifier("  adm-0042 ")).toBe("ADM-0042");
  });

  it("normalizes learner usernames from registered name fields and login input", () => {
    expect(normalizeStudentUsername(" Amina ", "Otieno", "  Wanjiku ")).toBe("amina wanjiku otieno");
    expect(normalizeStudentUsernameInput("  AMINA   OT IENO ")).toBe("amina ot ieno");
  });

  it("hashes secrets with a salted scrypt record and rejects wrong values", async () => {
    const encoded = await hashStudentSecret("LearnerPass42");
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]+\$[a-f0-9]+$/);
    expect(await verifyStudentSecret("LearnerPass42", encoded)).toBe(true);
    expect(await verifyStudentSecret("WrongPass42", encoded)).toBe(false);
    expect(await verifyStudentSecret("LearnerPass42", null)).toBe(false);
  });
});
