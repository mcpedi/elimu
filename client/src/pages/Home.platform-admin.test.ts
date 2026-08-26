import { describe, expect, it } from "vitest";
import { filterAndSortPlatformAdministrators, type PlatformAdministratorAccount } from "./Home";

const accounts: PlatformAdministratorAccount[] = [
  { id: 1, name: "Zuri Njeri", email: "zuri@example.com", role: "super_admin", hasSchoolAssignment: true, isPlatformAdmin: true, lastSignedIn: new Date("2026-08-20"), createdAt: new Date("2026-01-10") },
  { id: 2, name: "Amani Otieno", email: "amani@example.com", role: "super_admin", hasSchoolAssignment: false, isPlatformAdmin: false, lastSignedIn: new Date("2026-06-01"), createdAt: new Date("2026-03-05") },
  { id: 3, name: "Brian Wekesa", email: "brian@example.com", role: "super_admin", hasSchoolAssignment: true, isPlatformAdmin: false, lastSignedIn: new Date("2026-08-24"), createdAt: new Date("2026-02-20") },
];

describe("platform administrator directory controls", () => {
  it("filters accounts by name/email, assignment state, and 30-day activity without changing the source data", () => {
    const results = filterAndSortPlatformAdministrators(accounts, { query: "brian", assignment: "school_linked", activity: "active_30d", sort: "recent_activity", now: new Date("2026-08-26") });
    expect(results.map(account => account.id)).toEqual([3]);
    expect(accounts).toHaveLength(3);
  });

  it("sorts deterministically by the selected activity, name, and account-age modes", () => {
    expect(filterAndSortPlatformAdministrators(accounts, { query: "", assignment: "all", activity: "all", sort: "recent_activity", now: new Date("2026-08-26") }).map(account => account.id)).toEqual([3, 1, 2]);
    expect(filterAndSortPlatformAdministrators(accounts, { query: "", assignment: "all", activity: "all", sort: "name_asc", now: new Date("2026-08-26") }).map(account => account.id)).toEqual([2, 3, 1]);
    expect(filterAndSortPlatformAdministrators(accounts, { query: "", assignment: "all", activity: "all", sort: "newest_account", now: new Date("2026-08-26") }).map(account => account.id)).toEqual([2, 3, 1]);
  });
});
