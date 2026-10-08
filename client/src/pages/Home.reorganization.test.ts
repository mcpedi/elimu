import { describe, expect, it } from "vitest";
import { MODULE_WORKFLOW_OWNERS, roleNavigation, workspaceWorkflowVisibility } from "./Home";

describe("school workspace organization", () => {
  it("keeps learner registration, records, access, and student setup under Students", () => {
    expect(MODULE_WORKFLOW_OWNERS.students).toEqual([
      "registration",
      "learner records",
      "student lifecycle",
      "account access",
      "password recovery",
      "subject allocation",
      "digital IDs",
      "bulk import",
    ]);
  });

  it("keeps teacher profiles, account access, assignments, and staff attendance under Teachers", () => {
    expect(MODULE_WORKFLOW_OWNERS.teachers).toEqual([
      "teacher profiles",
      "teacher maintenance",
      "account access",
      "department assignment",
      "staff attendance",
      "teaching allocation",
      "class teacher assignment",
      "teaching workload",
    ]);
    expect(MODULE_WORKFLOW_OWNERS.academics).not.toContain("class teacher assignment");
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

  it("allows only leadership to change protected school records", () => {
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

  it("puts school functions under domain groups and removes the orphaned maintenance shortcuts", () => {
    const leadership = roleNavigation("principal");
    const ids = leadership.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining(["students", "teachers", "academics", "homework", "calendar", "announcements", "messages", "advanced", "reports"]));
    expect(ids).not.toContain("documents");
    expect(ids).not.toContain("manage");
    expect(leadership.find(item => item.id === "students")?.group).toBe("People");
    expect(leadership.find(item => item.id === "teachers")?.group).toBe("People");
    expect(leadership.find(item => item.id === "academics")?.group).toBe("Learning");
    expect(leadership.find(item => item.id === "fees")?.group).toBe("Finance");
  });

  it("prioritizes the right five everyday workflows in each mobile bottom bar", () => {
    expect(roleNavigation("principal").filter(item => item.mobilePrimary).map(item => item.id)).toEqual([
      "dashboard", "students", "teachers", "academics", "fees",
    ]);
    expect(roleNavigation("teacher").filter(item => item.mobilePrimary).map(item => item.id)).toEqual([
      "dashboard", "students", "academics", "homework", "attendance",
    ]);
    expect(roleNavigation("parent").filter(item => item.mobilePrimary).map(item => item.id)).toEqual([
      "dashboard", "students", "homework", "fees", "messages",
    ]);
  });

  it("exposes learning and communication workspaces to each role without exposing admin-only panels", () => {
    const teacher = roleNavigation("teacher").map(item => item.id);
    expect(teacher).toEqual(expect.arrayContaining(["homework", "calendar", "announcements", "messages"]));
    expect(teacher).not.toContain("documents");
    expect(teacher).not.toContain("settings");
    const learner = roleNavigation("student").map(item => item.id);
    expect(learner).toEqual(expect.arrayContaining(["homework", "calendar", "announcements"]));
    expect(learner).not.toContain("messages");
  });
});
