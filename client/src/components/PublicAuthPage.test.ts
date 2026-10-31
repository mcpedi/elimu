import { describe, expect, it } from "vitest";
import { PUBLIC_CAPABILITIES, PUBLIC_TRUST_POINTS } from "./PublicAuthPage";
import { ACCESS_MODE_COPY, accessFlow } from "./StudentLoginCard";

describe("public sign-in page", () => {
  it("groups every access mode into the two visible sign-in tabs", () => {
    expect(accessFlow("learner")).toBe("learner");
    expect(accessFlow("reset")).toBe("learner");
    expect(accessFlow("staff")).toBe("staff");
    expect(accessFlow("staff-reset")).toBe("staff");
    expect(accessFlow("setup")).toBe("staff");
  });

  it("keeps a single title and description for each sign-in mode", () => {
    for (const [mode, copy] of Object.entries(ACCESS_MODE_COPY)) {
      expect(copy.title.length, mode).toBeGreaterThan(0);
      expect(copy.description.length, mode).toBeGreaterThan(0);
      expect(copy.portal, mode).toMatch(/^(Learner portal|School access)$/);
    }
    expect(ACCESS_MODE_COPY.learner.portal).toBe("Learner portal");
    expect(ACCESS_MODE_COPY.staff.portal).toBe("School access");
  });

  it("explains the three core school workflows to first-time visitors", () => {
    expect(PUBLIC_CAPABILITIES.map(capability => capability.title)).toEqual(["Learner register", "Academics", "Fees"]);
    expect(PUBLIC_CAPABILITIES.every(capability => capability.copy.length > 20)).toBe(true);
    expect(PUBLIC_TRUST_POINTS.length).toBeGreaterThanOrEqual(2);
  });
});
