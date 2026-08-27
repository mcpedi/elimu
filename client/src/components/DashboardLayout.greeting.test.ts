import { describe, expect, it } from "vitest";
import { personnelGreeting, readableRole } from "./DashboardLayout";

describe("personnel dashboard greeting", () => {
  it("uses the signed-in person’s first name and time-appropriate greeting", () => {
    expect(personnelGreeting("Jacob Obuny", 8)).toBe("Good morning, Jacob");
    expect(personnelGreeting("Amina Otieno", 14)).toBe("Good afternoon, Amina");
    expect(personnelGreeting("Peter Maina", 19)).toBe("Good evening, Peter");
  });

  it("falls back safely when the account has no display name", () => {
    expect(personnelGreeting(null, 10)).toBe("Good morning, there");
    expect(personnelGreeting("   ", 18)).toBe("Good evening, there");
  });

  it("formats roles clearly for the header label", () => {
    expect(readableRole("super_admin")).toBe("Super Admin");
    expect(readableRole("deputy_principal")).toBe("Deputy Principal");
    expect(readableRole(null)).toBe("School User");
  });
});
