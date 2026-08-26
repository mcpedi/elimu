import { describe, expect, it } from "vitest";
import { SECTION_TRANSITION_MS, sectionTransitionDuration } from "./DashboardLayout";

describe("dashboard section transition", () => {
  it("uses a short branded transition duration", () => {
    expect(SECTION_TRANSITION_MS).toBeGreaterThan(0);
    expect(SECTION_TRANSITION_MS).toBeLessThanOrEqual(300);
    expect(sectionTransitionDuration(false)).toBe(SECTION_TRANSITION_MS);
  });

  it("disables the transition duration when reduced motion is requested", () => {
    expect(sectionTransitionDuration(true)).toBe(0);
  });
});
