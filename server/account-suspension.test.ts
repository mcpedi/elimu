import { describe, expect, it } from "vitest";
import { DISABLED_ACCOUNT_MESSAGE, isAccountDisabled, normalizeSuspensionReason } from "./account-suspension";

describe("account suspension policy", () => {
  it("uses the exact learner and staff login guidance", () => {
    expect(DISABLED_ACCOUNT_MESSAGE).toBe("Your account is temporarily disabled. Contact System Admin for help.");
  });

  it("normalizes an optional reason and provides a safe fallback", () => {
    expect(normalizeSuspensionReason("  Fees review  ")).toBe("Fees review");
    expect(normalizeSuspensionReason("   ")).toBe("Temporarily disabled by school administration");
    expect(normalizeSuspensionReason()).toBe("Temporarily disabled by school administration");
  });

  it("treats only a recorded timestamp as disabled", () => {
    expect(isAccountDisabled(new Date())).toBe(true);
    expect(isAccountDisabled(null)).toBe(false);
    expect(isAccountDisabled(undefined)).toBe(false);
  });
});
