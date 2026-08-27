import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { departments, schoolClasses, schools, assessments, studentFeeAccounts, studentSubjects, subjects, teacherAssignments, teacherAttendance, teachers, timetableSlots, marks, assignments, students, feeStructures, payments, users } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbState.current),
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "schools/1/branding/logo_123.png", url: "/manus-storage/schools/1/branding/logo_123.png" })),
}));

import { appRouter } from "./routers";
import { writeAuditLog } from "./db";

function fakeDb(rows: Map<unknown, unknown[]>) {
  const query = (table?: unknown): any => ({
    from: (next: unknown) => query(next),
    innerJoin: () => query(table),
    leftJoin: () => query(table),
    where: () => query(table),
    groupBy: () => query(table),
    orderBy: () => query(table),
    limit: async () => rows.get(table) ?? [],
    then: (resolve: any, reject?: any) => Promise.resolve(rows.get(table) ?? []).then(resolve, reject),
  });
  return {
    select: () => query(),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
    insert: (table: unknown) => ({ values: async (value: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const existing = rows.get(table) ?? [];
      const values = Array.isArray(value) ? value : [value];
      const nextId = existing.reduce((maximum, item) => Math.max(maximum, Number((item as { id?: number }).id ?? 0)), 0) + 1;
      existing.push(...values.map((item, index) => ({ id: item.id ?? nextId + index, ...item })));
      rows.set(table, existing);
      return [];
    } }),
  };
}

function context(role: "super_admin" | "parent", schoolId: number | null = 1, isPlatformAdmin = false): TrpcContext {
  return {
    user: { id: 1, openId: "management-test", schoolId, isPlatformAdmin, name: "Test", email: "test@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const school = { id: 1, name: "Test School" };

describe("record-management procedures", () => {
  it("restricts platform monitoring to explicitly designated platform administrators", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [users, []]]));
    await expect(appRouter.createCaller(context("super_admin")).school.platform.overview()).rejects.toThrow("restricted to designated platform administrators");
    await expect(appRouter.createCaller(context("parent", 1, true)).school.platform.overview()).rejects.toThrow("restricted to designated platform administrators");
    await expect(appRouter.createCaller(context("super_admin")).school.platform.administrators()).rejects.toThrow("restricted to designated platform administrators");
  });

  it("returns school inventory, active user counts, and unassigned accounts only to a platform administrator", async () => {
    const monitoredSchool = { ...school, code: "TST", county: "Nairobi", createdAt: new Date("2026-01-01"), registeredUsers: 3, activeUsers: 2 };
    const unassignedAccount = { id: 89, schoolId: null, name: "Awaiting Assignment", email: "awaiting@example.com", role: "teacher", lastSignedIn: new Date("2026-02-01"), createdAt: new Date("2026-01-20") };
    dbState.current = fakeDb(new Map([[schools, [monitoredSchool]], [users, [unassignedAccount]]]));

    const overview = await appRouter.createCaller(context("super_admin", 1, true)).school.platform.overview();

    expect(overview.totals).toEqual({ schools: 1, registeredUsers: 4, activeUsers: 2, unassignedAccounts: 1 });
    expect(overview.schools).toEqual([expect.objectContaining({ id: 1, code: "TST", registeredUsers: 3, activeUsers: 2 })]);
    expect(overview.unassignedAccounts).toEqual([expect.objectContaining({ id: 89, email: "awaiting@example.com" })]);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.monitor_viewed", actorUserId: 1, entityType: "platform" }));
  });

  it("lists only data-minimized Super Administrator candidates and current platform administrators", async () => {
    const activePlatformAdmin = { id: 2, openId: "platform-admin", schoolId: 1, isPlatformAdmin: true, name: "Platform Admin", email: "platform@example.com", role: "super_admin", lastSignedIn: new Date("2026-02-04"), createdAt: new Date("2026-01-01") };
    const eligibleSuperAdmin = { id: 3, openId: "eligible-admin", schoolId: 2, isPlatformAdmin: false, name: "Eligible Admin", email: "eligible@example.com", role: "super_admin", lastSignedIn: new Date("2026-02-03"), createdAt: new Date("2026-01-02") };
    const nonSuperAdmin = { id: 4, openId: "teacher", schoolId: 2, isPlatformAdmin: false, name: "Teacher", email: "teacher@example.com", role: "teacher", lastSignedIn: new Date(), createdAt: new Date() };
    dbState.current = fakeDb(new Map([[users, [activePlatformAdmin, eligibleSuperAdmin, nonSuperAdmin]]]));

    const listing = await appRouter.createCaller(context("super_admin", 1, true)).school.platform.administrators();

    expect(listing.administrators).toEqual([expect.objectContaining({ id: 2, name: "Platform Admin" })]);
    expect(listing.eligibleAccounts).toEqual([expect.objectContaining({ id: 3, email: "eligible@example.com" })]);
    expect(listing.administrators[0]).not.toHaveProperty("openId");
    expect(listing.administrators[0]).not.toHaveProperty("schoolId");
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.admin_management_viewed", actorUserId: 1, entityType: "platform" }));
  });

  it("designates and revokes eligible Super Administrators with audit events while preventing self-lockout", async () => {
    const eligibleSuperAdmin = { id: 2, openId: "eligible-admin", schoolId: 2, isPlatformAdmin: false, role: "super_admin" };
    dbState.current = fakeDb(new Map([[users, [eligibleSuperAdmin]]]));
    const caller = appRouter.createCaller(context("super_admin", 1, true));

    await expect(caller.school.platform.designateAdministrator({ userId: 2 })).resolves.toEqual({ success: true, changed: true });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.administrator_designated", actorUserId: 1, entityId: 2 }));
    await expect(caller.school.platform.revokeAdministrator({ userId: 1 })).rejects.toThrow("cannot revoke your own");

    dbState.current = fakeDb(new Map([[users, [{ ...eligibleSuperAdmin, isPlatformAdmin: true }]]]));
    await expect(caller.school.platform.revokeAdministrator({ userId: 2 })).resolves.toEqual({ success: true });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.administrator_revoked", actorUserId: 1, entityId: 2 }));

    dbState.current = fakeDb(new Map([[users, [{ id: 9, role: "teacher", isPlatformAdmin: false }]]]));
    await expect(caller.school.platform.designateAdministrator({ userId: 9 })).rejects.toThrow("Only Super Administrator");
  });

  it("registers additional schools only for designated platform administrators and rejects duplicate codes", async () => {
    dbState.current = fakeDb(new Map([[schools, [{ id: 1, name: "Existing School", code: "EXIST", county: "Nairobi", createdAt: new Date() }]], [users, []]]));
    await expect(appRouter.createCaller(context("super_admin")).school.platform.registerSchool({ name: "Nyota School", code: "nyt", county: "Kiambu" })).rejects.toThrow("restricted to designated platform administrators");

    const caller = appRouter.createCaller(context("super_admin", 1, true));
    await expect(caller.school.platform.registerSchool({ name: "Nyota School", code: "nyt", county: "Kiambu" })).resolves.toMatchObject({ name: "Nyota School", code: "NYT" });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.school_registered", actorUserId: 1, entityType: "school", metadata: { code: "NYT" } }));
    await expect(caller.school.platform.registerSchool({ name: "Duplicate Nyota", code: "NYT" })).rejects.toThrow("already registered");
  });

  it("assigns only unassigned accounts to a selected school role and audits the platform onboarding action", async () => {
    const targetSchool = { id: 2, name: "Nyota School", code: "NYT" };
    const unassignedAccount = { id: 28, schoolId: null, role: "user" };
    dbState.current = fakeDb(new Map([[schools, [targetSchool]], [users, [unassignedAccount]]]));
    const caller = appRouter.createCaller(context("super_admin", 1, true));

    await expect(caller.school.platform.assignUnassignedAccount({ schoolId: 2, userId: 28, role: "user" as never })).rejects.toThrow();
    await expect(caller.school.platform.assignUnassignedAccount({ schoolId: 2, userId: 28, role: "principal" })).resolves.toEqual({ success: true });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.unassigned_account_assigned", actorUserId: 1, schoolId: 2, entityId: 28, metadata: { role: "principal", schoolCode: "NYT" } }));

    dbState.current = fakeDb(new Map([[schools, [targetSchool]], [users, [{ id: 29, schoolId: 9, role: "teacher" }]]]));
    await expect(caller.school.platform.assignUnassignedAccount({ schoolId: 2, userId: 29, role: "teacher" })).rejects.toThrow("already assigned to a school");
  });

  it("fails closed for an authenticated account without a school binding", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [departments, []]]));
    await expect(appRouter.createCaller(context("super_admin", null)).school.academics.createDepartment({ name: "Sciences", code: "sci" })).rejects.toThrow("not assigned to a school");
  });

  it("does not return students, teachers, or subjects from another school in search", async () => {
    dbState.current = fakeDb(new Map([
      [schools, [school]],
      [students, [{ id: 22, schoolId: 2, firstName: "Foreign", lastName: "Learner", admissionNo: "OTHER-0001" }]],
      [teachers, [{ id: 32, schoolId: 2, firstName: "Foreign", lastName: "Teacher", employeeNo: "OTHER-T1" }]],
      [subjects, [{ id: 42, schoolId: 2, name: "Foreign Subject", code: "OTHER-SUB" }]],
    ]));

    await expect(appRouter.createCaller(context("super_admin")).school.search({ query: "Foreign" })).resolves.toEqual({ students: [], teachers: [], subjects: [] });
  });

  it("does not assign a school role to a user already bound to another school", async () => {
    const foreignUser = { id: 99, schoolId: 2, role: "teacher" };
    dbState.current = fakeDb(new Map([[schools, [school]], [users, [foreignUser]]]));
    await expect(appRouter.createCaller(context("super_admin")).school.access.assignRole({ userId: 99, role: "principal" })).rejects.toThrow("belongs to a different school");
  });

  it("accepts a valid school logo for an authorised administrator", async () => {
    const png = Buffer.alloc(40);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    dbState.current = fakeDb(new Map([[schools, [school]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.setup.uploadLogo({ fileName: "school-logo.png", mimeType: "image/png", data: png.toString("base64") })).resolves.toMatchObject({ success: true, logoUrl: "/manus-storage/schools/1/branding/logo_123.png" });
  });

  it("rejects invalid logo signatures and non-administrator upload attempts", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.setup.uploadLogo({ fileName: "logo.png", mimeType: "image/png", data: Buffer.alloc(40, 65).toString("base64") })).rejects.toThrow("does not match its image type");
    await expect(appRouter.createCaller(context("parent")).school.setup.uploadLogo({ fileName: "logo.png", mimeType: "image/png", data: Buffer.alloc(40, 65).toString("base64") })).rejects.toThrow();
  });

  it("creates a school-scoped department with normalized code and an audit event, while blocking portal users", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [departments, []]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.academics.createDepartment({ name: "Sciences", code: "sci" })).resolves.toEqual({ success: true });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 1, action: "department.created", entityType: "department", metadata: { name: "Sciences", code: "SCI" } }));
    await expect(appRouter.createCaller(context("parent")).school.academics.createDepartment({ name: "Arts", code: "art" })).rejects.toThrow();
  });

  it("allows finance staff to create a learner fee account for a matching class structure", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, currentClassId: 4 }]], [feeStructures, [{ id: 21, classId: 4 }]], [studentFeeAccounts, []]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.finance.createAccount({ studentId: 11, feeStructureId: 21, amountDue: 18500, dueDate: "2026-09-30" })).resolves.toMatchObject({ success: true });
  });

  it("allows a leadership user to generate audited statements and receipts", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, currentClassId: 4 }]], [payments, [{ id: 31 }]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.finance.recordDocument({ documentType: "statement", studentId: 11, format: "pdf" })).resolves.toEqual({ success: true });
    await expect(caller.school.finance.recordDocument({ documentType: "receipt", studentId: 11, paymentId: 31, format: "pdf" })).resolves.toEqual({ success: true });
  });

  it("returns learner-scoped statement and receipt data and blocks unlinked parents", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, admissionNo: "ADM-001", firstName: "Amina", lastName: "Otieno" }]], [studentFeeAccounts, [{ feeName: "Term 1", due: "15000", paid: "5000", amountDue: "15000", amountPaid: "5000", status: "partial" }]], [feeStructures, []], [payments, [{ id: 31, studentId: 11, receiptNo: "RCT-001", amount: "5000", method: "mpesa", paymentDate: new Date("2026-09-01"), amountDue: "15000", amountPaid: "5000", reference: "MPESA-1", payerName: "Parent" }]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    const statement = await caller.school.finance.studentStatement({ studentId: 11 });
    expect(statement.student.admissionNo).toBe("ADM-001");
    expect(statement.balance).toBe(10000);
    const receipt = await caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 });
    expect(receipt.receipt.receiptNo).toBe("RCT-001");
    expect(receipt.receipt.balance).toBe(10000);
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]], [payments, []]]));
    await expect(caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("Payment receipt not found");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]], [payments, [{ id: 31, studentId: 22, receiptNo: "RCT-OTHER" }]]]));
    await expect(caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("Payment receipt not found");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]] ]));
    await expect(appRouter.createCaller(context("parent")).school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("linked to your account");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, []]]));
    await expect(appRouter.createCaller(context("parent")).school.finance.studentStatement({ studentId: 11 })).rejects.toThrow("linked to your account");
  });

  it("links, updates, and clears a school-scoped learner email while rejecting duplicates and portal users", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, schoolId: 1, email: null }, { id: 12, schoolId: 1, email: "other@example.com" }, { id: 13, schoolId: 2, email: "foreign@example.com" }]] ]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.students.updateStudentEmail({ studentId: 11, email: " Learner@Example.com " })).resolves.toEqual({ success: true, email: "learner@example.com" });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.email_updated", entityType: "student", entityId: 11, metadata: expect.objectContaining({ email: "learner@example.com", cleared: false }) }));
    await expect(caller.school.students.updateStudentEmail({ studentId: 11, email: "other@example.com" })).rejects.toThrow("already linked");
    await expect(caller.school.students.updateStudentEmail({ studentId: 11 })).resolves.toEqual({ success: true, email: null });
    await expect(appRouter.createCaller(context("parent")).school.students.updateStudentEmail({ studentId: 11, email: "parent@example.com" })).rejects.toThrow();
    dbState.current = fakeDb(new Map([[schools, [school]], [students, []]]));
    await expect(caller.school.students.updateStudentEmail({ studentId: 13, email: "foreign-update@example.com" })).rejects.toThrow("Student not found");
  });

  it("bulk-links learner emails by admission number with duplicate validation and partial feedback", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, schoolId: 1, admissionNo: "ADM-001", email: null }, { id: 12, schoolId: 1, admissionNo: "ADM-002", email: "used@example.com" }, { id: 13, schoolId: 1, admissionNo: "ADM-003", email: null }]] ]));
    const caller = appRouter.createCaller(context("super_admin"));
    const result = await caller.school.students.bulkUpdateEmails({ rows: [{ admissionNo: "adm-001", email: "Learner@Example.com" }, { admissionNo: "ADM-001", email: "second@example.com" }, { admissionNo: "ADM-003", email: "used@example.com" }, { admissionNo: "ADM-404", email: "missing@example.com" }] });
    expect(result.updated).toBe(1);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3, message: "duplicate admission number in import" }), expect.objectContaining({ row: 4, message: "email is already linked to another learner in this school" }), expect.objectContaining({ row: 5, message: "admission number was not found in this school" })]));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.emails_bulk_updated", metadata: expect.objectContaining({ updated: 1, rejected: 3 }) }));
    await expect(appRouter.createCaller(context("parent")).school.students.bulkUpdateEmails({ rows: [{ admissionNo: "ADM-001", email: "parent@example.com" }] })).rejects.toThrow();
  });

  it("updates the learner login school code with normalization, duplicate protection, and audit coverage", async () => {
    dbState.current = fakeDb(new Map([[schools, [{ id: 1, name: "Test School", code: "OLD-CODE" }, { id: 2, name: "Other School", code: "TAKEN" }]] ]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.setup.updateSchoolCode({ code: " new-code " })).resolves.toEqual({ success: true, code: "NEW-CODE" });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "school.login_code_updated", metadata: expect.objectContaining({ previousCode: "OLD-CODE", code: "NEW-CODE" }) }));
    await expect(caller.school.setup.updateSchoolCode({ code: "TAKEN" })).rejects.toThrow("already used by another school");
    await expect(appRouter.createCaller(context("parent")).school.setup.updateSchoolCode({ code: "PARENT-CODE" })).rejects.toThrow();
  });

  it("creates one assessment per stream for a form-wide exam target and audits the target form", async () => {
    const classes = [{ id: 11, schoolId: 1, form: "Form 1", stream: "East" }, { id: 12, schoolId: 1, form: "Form 1", stream: "West" }];
    dbState.current = fakeDb(new Map([[schools, [{ ...school, code: "TST" }]], [schoolClasses, classes], [assessments, []]]));
    const result = await appRouter.createCaller(context("super_admin")).school.academics.createAssessment({ academicYearId: 1, termId: 1, targetForm: "Form 1", title: "Mid Term Exam", assessmentType: "exam", maxMarks: 100, assessmentDate: "2026-05-14" });
    expect(result).toEqual({ success: true, count: 2, targetForm: "Form 1" });
    expect(dbState.current).toBeTruthy();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "assessment.created", metadata: expect.objectContaining({ targetForm: "Form 1", assessmentDate: "2026-05-14", classIds: [11, 12] }) }));
    await expect(appRouter.createCaller(context("teacher")).school.academics.createAssessment({ academicYearId: 1, termId: 1, targetForm: "Form 1", title: "Teacher Form Exam", assessmentType: "exam", maxMarks: 100, assessmentDate: "2026-05-15" })).rejects.toThrow("Only school leadership");
  });

  it("blocks portal users from all protected record-management mutations", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]]]));
    const caller = appRouter.createCaller(context("parent"));
    await expect(caller.school.academics.updateSubject({ subjectId: 1, code: "KIS", name: "Kiswahili", category: "compulsory", isActive: true })).rejects.toThrow();
    await expect(caller.school.teachers.update({ teacherId: 1, employeeNo: "T-01", firstName: "Amina", lastName: "Otieno", employmentStatus: "active" })).rejects.toThrow();
    await expect(caller.school.academics.updateClass({ classId: 1, capacity: 45, classTeacherId: null })).rejects.toThrow();
    await expect(caller.school.finance.adjustAccount({ studentFeeAccountId: 1, amountDue: 1000, reason: "Corrected fee structure" })).rejects.toThrow();
  });

  it("allows leadership to update a subject and blocks removal when it is linked to learners", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [subjects, [{ id: 1, name: "Kiswahili" }]], [studentSubjects, [{ id: 1 }]], [teacherAssignments, []], [marks, []], [timetableSlots, []], [assignments, []]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.academics.updateSubject({ subjectId: 1, code: "KIS", name: "Kiswahili", category: "compulsory", isActive: true })).resolves.toEqual({ success: true });
    await expect(caller.school.academics.removeSubject({ subjectId: 1 })).rejects.toThrow("learnerAllocations");
  });

  it("updates class capacity and assigns an active class teacher", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [schoolClasses, [{ id: 1 }]], [teachers, [{ id: 7 }]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.academics.updateClass({ classId: 1, capacity: 40, classTeacherId: 7 })).resolves.toEqual({ success: true });
  });

  it("blocks teacher removal with linked data and adjusts a fee account only above recorded payments", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [teachers, [{ id: 7, firstName: "Amina", lastName: "Otieno" }]], [schoolClasses, [{ id: 1 }]], [teacherAssignments, []], [timetableSlots, []], [teacherAttendance, []], [marks, []], [assignments, []]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.teachers.remove({ teacherId: 7 })).rejects.toThrow("classes");
    dbState.current = fakeDb(new Map([[schools, [school]], [studentFeeAccounts, [{ id: 9, amountDue: "1000", amountPaid: "250" }]]]));
    await expect(caller.school.finance.adjustAccount({ studentFeeAccountId: 9, amountDue: 1200, reason: "Corrected term fee allocation" })).resolves.toMatchObject({ success: true, balance: 950 });
    await expect(caller.school.finance.adjustAccount({ studentFeeAccountId: 9, amountDue: 200, reason: "Invalid adjustment attempt" })).rejects.toThrow("cannot be lower than recorded payments");
  });
});
