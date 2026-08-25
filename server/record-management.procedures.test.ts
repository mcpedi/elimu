import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { schoolClasses, schools, studentFeeAccounts, studentSubjects, subjects, teacherAssignments, teacherAttendance, teachers, timetableSlots, marks, assignments, students, feeStructures, payments } from "../drizzle/schema";

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
    then: (resolve: any, reject?: any) => Promise.resolve(rows.get(table) ?? []).then(resolve, reject),
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

  it("allows a leadership user to generate audited statements and receipts", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, currentClassId: 4 }]], [payments, [{ id: 31 }]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    await expect(caller.school.finance.recordDocument({ documentType: "statement", studentId: 11, format: "pdf" })).resolves.toEqual({ success: true });
    await expect(caller.school.finance.recordDocument({ documentType: "receipt", studentId: 11, paymentId: 31, format: "pdf" })).resolves.toEqual({ success: true });
  });

  it("returns learner-scoped statement and receipt data and blocks unlinked parents", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11, admissionNo: "ADM-001", firstName: "Amina", lastName: "Otieno" }]], [studentFeeAccounts, [{ feeName: "Term 1", due: "15000", paid: "5000", status: "partial" }]], [feeStructures, []], [payments, [{ id: 31, studentId: 11, receiptNo: "RCT-001", amount: "5000", method: "mpesa", paymentDate: new Date("2026-09-01"), reference: "MPESA-1", payerName: "Parent" }]]]));
    const caller = appRouter.createCaller(context("super_admin"));
    const statement = await caller.school.finance.studentStatement({ studentId: 11 });
    expect(statement.student.admissionNo).toBe("ADM-001");
    expect(statement.balance).toBe(10000);
    const receipt = await caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 });
    expect(receipt.receipt.receiptNo).toBe("RCT-001");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]], [payments, []]]));
    await expect(caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("Payment receipt not found");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]], [payments, [{ id: 31, studentId: 22, receiptNo: "RCT-OTHER" }]]]));
    await expect(caller.school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("Payment receipt not found");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [{ id: 11 }]] ]));
    await expect(appRouter.createCaller(context("parent")).school.finance.paymentReceipt({ studentId: 11, paymentId: 31 })).rejects.toThrow("linked to your account");
    dbState.current = fakeDb(new Map([[schools, [school]], [students, []]]));
    await expect(appRouter.createCaller(context("parent")).school.finance.studentStatement({ studentId: 11 })).rejects.toThrow("linked to your account");
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
