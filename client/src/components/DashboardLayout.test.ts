import { describe, expect, it } from "vitest";
import { NOTIFICATION_REFRESH_INTERVAL_MS, SECTION_TRANSITION_MS, notificationBadgeLabel, sectionTransitionDuration } from "./DashboardLayout";

describe("dashboard section transition", () => {
  it("uses a short branded transition duration", () => {
    expect(SECTION_TRANSITION_MS).toBeGreaterThan(0);
    expect(SECTION_TRANSITION_MS).toBeLessThanOrEqual(300);
    expect(sectionTransitionDuration(false)).toBe(SECTION_TRANSITION_MS);
  });

  it("disables the transition duration when reduced motion is requested", () => {
    expect(sectionTransitionDuration(true)).toBe(0);
  });

  it("refreshes live notifications frequently and keeps the badge compact", () => {
    expect(NOTIFICATION_REFRESH_INTERVAL_MS).toBe(10_000);
    expect(notificationBadgeLabel(0)).toBe("0");
    expect(notificationBadgeLabel(4)).toBe("4");
    expect(notificationBadgeLabel(12)).toBe("9+");
  });
});
