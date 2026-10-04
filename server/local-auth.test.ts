import { describe, expect, it } from "vitest";
import { createLocalSetupCode, hashStudentSecret, normalizeLocalUsername, readLocalSessionToken, verifyStudentSecret } from "./local-auth";

describe("local authentication helpers", () => {
  it("normalizes local usernames consistently", () => {
    expect(normalizeLocalUsername("  Principal.Office ")).toBe("principal.office");
    expect(normalizeLocalUsername("Amina  Otieno")).toBe("aminaotieno");
  });

  it("creates unpredictable-looking setup codes", () => {
    const code = createLocalSetupCode();
    expect(code).toMatch(/^[A-F0-9]{12}$/);
  });

  it("uses the hardened scrypt format for local passwords", async () => {
    const encoded = await hashStudentSecret("LocalPass42");
    expect(await verifyStudentSecret("LocalPass42", encoded)).toBe(true);
    expect(await verifyStudentSecret("WrongPass42", encoded)).toBe(false);
  });

  it("reads only the local session cookie from the request header", () => {
    const req = { headers: { cookie: "other=value; elimubora_local_session=abc123" } } as never;
    expect(readLocalSessionToken(req)).toBe("abc123");
  });
});
