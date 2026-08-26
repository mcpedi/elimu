import { describe, expect, it } from "vitest";
import { MODULE_WORKFLOW_OWNERS, workspaceWorkflowVisibility } from "./Home";

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
});
