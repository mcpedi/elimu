import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { academicYears, feeStructures, payments, reportCards, schoolClasses, schools, studentFeeAccounts, students, subjects, teacherAssignments, teachers, terms } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbState.current),
  writeAuditLog: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";

function fakeDb(initial: Map<unknown, any[]>) {
  const rowsFor = (table?: unknown) => initial.get(table) ?? [];
  const query = (table?: unknown): any => ({
    from: (next: unknown) => query(next),
    innerJoin: () => query(table),
    leftJoin: () => query(table),
    orderBy: () => query(table),
    where: () => query(table),
    limit: async () => rowsFor(table),
    then: (resolve: any, reject?: any) => Promise.resolve(rowsFor(table)).then(resolve, reject),
  });
  return { select: () => query() };
}

function context(role: "teacher" | "class_teacher" | "principal" | "bursar" | "parent", userId: number, schoolId = 1) {
  return {
    user: { id: userId, openId: `report-sheet-${userId}`, schoolId, name: "Report Sheet Test", email: "sheets@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  } satisfies TrpcContext;
}

const school = { id: 1, name: "Bora Secondary", code: "BRB", phone: "+254700000111", email: "office@bora.school", address: "Nakuru", logoKey: "schools/bora.png", gradeScale: null };
const schoolClass = { id: 41, schoolId: 1, form: "Form 2", stream: "East", classTeacherId: 91 };
const academicYear = { id: 21, schoolId: 1, name: "2026", isActive: true };
const term = { id: 31, academicYearId: 21, name: "Term 1", isActive: true };
const learners = [
  { id: 11, schoolId: 1, admissionNo: "ADM-0042", firstName: "Amina", lastName: "Otieno", currentClassId: 41, status: "active" },
  { id: 12, schoolId: 1, admissionNo: "ADM-0043", firstName: "Brian", lastName: "Kamau", currentClassId: 41, status: "active" },
  { id: 13, schoolId: 1, admissionNo: "ADM-0044", firstName: "Cynthia", lastName: "Wanjiru", currentClassId: 41, status: "active" },
];
const card = (studentId: number, math: number, english: number) => ({
  id: 100 + studentId,
  schoolId: 1,
  studentId,
  academicYearId: 21,
  termId: 31,
  classId: 41,
  resultSnapshot: [
    { subjectId: 51, subject: "Mathematics", subjectCode: "MAT", score: math, maxMarks: 100, grade: math >= 80 ? "A" : "B", gradePoints: math >= 80 ? 12 : 9 },
    { subjectId: 52, subject: "English", subjectCode: "ENG", score: english, maxMarks: 100, grade: english >= 80 ? "A" : "B", gradePoints: english >= 80 ? 12 : 9 },
  ],
});

function tables() {
  const entries: Array<[unknown, any[]]> = [
    [schools, [school]],
    [schoolClasses, [schoolClass]],
    [academicYears, [academicYear]],
    [terms, [term]],
    [students, learners],
    [reportCards, [card(11, 82, 74), card(12, 66, 60)]],
    [teachers, [{ id: 91, schoolId: 1, userId: 501, employmentStatus: "active" }]],
    [teacherAssignments, [{ id: 81, schoolId: 1, teacherId: 91, classId: 41, subjectId: 51, academicYearId: 21, termId: 31 }]],
    [subjects, [{ id: 51, schoolId: 1, name: "Mathematics", code: "MAT" }]],
    [feeStructures, [{ id: 61, schoolId: 1, name: "Term 1 tuition", termId: 31 }]],
    [
      studentFeeAccounts,
      [
        { id: 71, studentId: 11, feeStructureId: 61, feeName: "Term 1 tuition", termId: 31, due: "20000", paid: "20000", status: "paid", dueDate: new Date("2026-02-05T00:00:00.000Z") },
        { id: 72, studentId: 12, feeStructureId: 61, feeName: "Term 1 tuition", termId: 31, due: "22000", paid: "12000", status: "partial", dueDate: new Date("2026-02-05T00:00:00.000Z") },
      ],
    ],
    [payments, [{ id: 91, studentId: 11, receiptNo: "RCPT-0001", amount: "20000", method: "mpesa", paymentDate: new Date("2026-02-01T00:00:00.000Z") }]],
  ];
  return new Map(entries);
}

describe("report sheet procedures", () => {
  it("builds a ranked class result sheet for a class teacher's own class", async () => {
    dbState.current = fakeDb(tables());
    const sheet = await appRouter.createCaller(context("class_teacher", 501)).school.reports.classResultSheet({ classId: 41, academicYearId: 21, termId: 31 });

    expect(sheet).toMatchObject({ academicYear: "2026", term: "Term 1" });
    expect(sheet.school).toEqual({ name: "Bora Secondary", code: "BRB", phone: "+254700000111", email: "office@bora.school", address: "Nakuru", logoUrl: "/manus-storage/schools/bora.png" });
    expect(sheet.class).toMatchObject({ id: 41, form: "Form 2", stream: "East" });
    expect(sheet.subjects.map(subject => subject.code)).toEqual(["ENG", "MAT"]);
    expect(sheet.rows.map(row => [row.fullName, row.average, row.overallGrade, row.position])).toEqual([
      ["Amina Otieno", 78, "A-", 1],
      ["Brian Kamau", 63, "B-", 2],
      ["Cynthia Wanjiru", null, null, null],
    ]);
    expect(sheet.summary).toMatchObject({ learners: 3, graded: 2, classMean: 70.5 });
    expect(sheet.summary.gradeDistribution).toEqual([{ grade: "A-", count: 1 }, { grade: "B-", count: 1 }]);
  });

  it("rejects a teacher who is not assigned to the class", async () => {
    const tablesWithoutAssignment = tables();
    tablesWithoutAssignment.set(teacherAssignments, []);
    dbState.current = fakeDb(tablesWithoutAssignment);

    await expect(appRouter.createCaller(context("teacher", 501)).school.reports.classResultSheet({ classId: 41, academicYearId: 21, termId: 31 })).rejects.toThrow("You are not assigned to this class and subject.");
  });

  it("keeps finance-only roles out of the academic result sheet", async () => {
    dbState.current = fakeDb(tables());
    await expect(appRouter.createCaller(context("bursar", 601)).school.reports.classResultSheet({ classId: 41, academicYearId: 21, termId: 31 })).rejects.toThrow("Your role is not permitted to perform this action.");
  });

  it("rejects a term that does not belong to the selected academic year", async () => {
    const tablesWithoutTerm = tables();
    tablesWithoutTerm.set(terms, []);
    dbState.current = fakeDb(tablesWithoutTerm);
    await expect(appRouter.createCaller(context("principal", 201)).school.reports.classResultSheet({ classId: 41, academicYearId: 21, termId: 999 })).rejects.toThrow("Select a term from the selected academic year.");
  });

  it("returns a class fee statement for the bursar with real balances", async () => {
    dbState.current = fakeDb(tables());
    const sheet = await appRouter.createCaller(context("bursar", 601)).school.reports.feeStatementSheet({ classId: 41, termId: 31 });

    expect(sheet.term).toMatchObject({ id: 31, name: "Term 1" });
    expect(sheet.school.logoUrl).toBe("/manus-storage/schools/bora.png");
    expect(sheet.totals).toEqual({ learners: 3, billed: 42000, paid: 32000, balance: 10000, cleared: 1, outstanding: 1 });
    expect(sheet.rows.map(row => [row.fullName, row.billed, row.paid, row.balance, row.status])).toEqual([
      ["Amina Otieno", 20000, 20000, 0, "cleared"],
      ["Brian Kamau", 22000, 12000, 10000, "partial"],
      ["Cynthia Wanjiru", 0, 0, 0, "no_charge"],
    ]);
    expect(sheet.rows[0].payments).toEqual([{ receiptNo: "RCPT-0001", amount: 20000, method: "mpesa", paymentDate: "2026-02-01" }]);
    expect(sheet.rows[1].payments).toEqual([]);
  });

  it("keeps teaching roles out of the fee statement sheet", async () => {
    dbState.current = fakeDb(tables());
    await expect(appRouter.createCaller(context("teacher", 501)).school.reports.feeStatementSheet({ classId: 41 })).rejects.toThrow("Your role is not permitted to perform this action.");
  });

  it("fails closed when the signed-in user's school is not present", async () => {
    dbState.current = fakeDb(tables());
    await expect(appRouter.createCaller(context("principal", 301, 2)).school.reports.feeStatementSheet({ classId: 41 })).rejects.toThrow("school access is unavailable");
  });

  it("reports class options with active learner counts for the report builder", async () => {
    dbState.current = fakeDb(tables());
    const options = await appRouter.createCaller(context("principal", 201)).school.reports.sheetOptions();
    expect(options.classes).toMatchObject([{ id: 41, form: "Form 2", stream: "East", learners: 3 }]);
    expect(options.academicYears).toMatchObject([{ id: 21, name: "2026", isActive: true }]);
    expect(options.terms).toMatchObject([{ id: 31, name: "Term 1", academicYearId: 21, isActive: true }]);
  });
});
