import { describe, expect, it } from "vitest";
import { notificationCategoryMeta } from "./LiveNotificationCenter";

describe("notification category presentation", () => {
  it("maps operational categories to distinct labels and icons", () => {
    const finance = notificationCategoryMeta("finance");
    const academics = notificationCategoryMeta("academics");
    const announcements = notificationCategoryMeta("announcements");

    expect(finance.label).toBe("Finance");
    expect(academics.label).toBe("Academics");
    expect(announcements.label).toBe("Announcement");
    expect(finance.Icon).not.toBe(academics.Icon);
    expect(academics.Icon).not.toBe(announcements.Icon);
    expect(finance.iconClass).not.toBe(academics.iconClass);
  });

  it("falls back safely for legacy or unknown categories", () => {
    const meta = notificationCategoryMeta("legacy-category");
    expect(meta.label).toBe("General");
    expect(meta.Icon).toBeTruthy();
    expect(meta.badgeClass).toContain("slate");
  });
});
