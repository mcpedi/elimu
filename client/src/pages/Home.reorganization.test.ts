import { describe, expect, it } from "vitest";
import { MODULE_WORKFLOW_OWNERS, roleNavigation, workspaceWorkflowVisibility } from "./Home";

describe("Shule OS module ownership", () => {
  it("keeps every fee workflow under Fees", () => {
    expect(MODULE_WORKFLOW_OWNERS.fees).toEqual([
      "fee structures",
      "learner fee accounts",
      "payments",
      "balance corrections",
      "statements",
      "receipts",
      "collection reports",
    ]);
    expect(new Set(MODULE_WORKFLOW_OWNERS.fees).size).toBe(MODULE_WORKFLOW_OWNERS.fees.length);
  });

  it("keeps academic setup and assessment workflows under Academics", () => {
    expect(MODULE_WORKFLOW_OWNERS.academics).toEqual([
      "classes",
      "subjects",
      "departments",
      "assessment setup",
      "marks entry",
      "report cards",
      "class capacity",
    ]);
    expect(MODULE_WORKFLOW_OWNERS.academics).not.toContain("payments");
    expect(MODULE_WORKFLOW_OWNERS.academics).not.toContain("announcements");
  });

  it("allows only leadership to change management records and publish targeted notices", () => {
    expect(workspaceWorkflowVisibility("principal")).toMatchObject({
      students: true,
      teachers: true,
      academics: true,
      fees: true,
      timetable: true,
      announcements: true,
      manage: true,
    });
    expect(workspaceWorkflowVisibility("bursar")).toMatchObject({
      students: false,
      teachers: false,
      academics: false,
      fees: true,
      timetable: false,
      announcements: false,
      manage: false,
    });
    expect(workspaceWorkflowVisibility("teacher")).toMatchObject({
      academics: true,
      attendance: true,
      fees: false,
      manage: false,
    });
  });

  it("keeps platform monitoring hidden until a Super Administrator has server-approved platform access", () => {
    expect(roleNavigation("super_admin", false).map(item => item.id)).not.toContain("platform");
    expect(roleNavigation("super_admin", true).map(item => item.id)).toContain("platform");
    expect(roleNavigation("principal", true).map(item => item.id)).not.toContain("platform");
  });

  it("exposes the new MVP workspaces through role-appropriate navigation", () => {
    const leadership = roleNavigation("principal").map(item => item.id);
    expect(leadership).toEqual(expect.arrayContaining(["homework", "calendar", "messages", "advanced", "documents"]));
    const teacher = roleNavigation("teacher").map(item => item.id);
    expect(teacher).toEqual(expect.arrayContaining(["homework", "calendar", "messages"]));
    expect(teacher).not.toContain("documents");
    const learner = roleNavigation("student").map(item => item.id);
    expect(learner).toEqual(expect.arrayContaining(["homework", "calendar"]));
    expect(learner).not.toContain("messages");
  });
});
