import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { schoolClasses, schools, studentFeeAccounts, studentSubjects, subjects, teacherAssignments, teacherAttendance, teachers, timetableSlots, marks, assignments, students, feeStructures } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbState.current),
  writeAuditLog: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";

function fakeDb(rows: Map<unknown, unknown[]>) {
  const query = (table?: unknown): any => ({
    from: (next: unknown) => query(next),
    innerJoin: () => query(table),
    leftJoin: () => query(table),
    where: () => query(table),
    orderBy: () => query(table),
    limit: async () => rows.get(table) ?? [],
  });
  return {
    select: () => query(),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
    insert: () => ({ values: async () => [] }),
  };
}

function context(role: "super_admin" | "parent"): TrpcContext {
  return {
    user: { id: 1, openId: "management-test", name: "Test", email: "test@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const school = { id: 1, name: "Test School" };

describe("record-management procedures", () => {
  it("allows finance staff to create a learner fee account for a matching class structure", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, currentClassId: 4 }]], [feeStructures, [{ id: 21, classId: 4 }]], [studentFeeAccounts, []]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.finance.createAccount({ studentId: 11, feeStructureId: 21, amountDue: 18500, dueDate: "2026-09-30" })).resolves.toMatchObject({ success: true });
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
