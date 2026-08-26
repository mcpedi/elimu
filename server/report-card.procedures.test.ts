import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { academicYears, assessments, marks, reportCards, reportExports, schoolClasses, schools, students, subjects, teacherAssignments, teachers, terms, users } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbState.current),
  writeAuditLog: vi.fn(async () => undefined),
}));

import { writeAuditLog } from "./db";
import { appRouter } from "./routers";

function fakeDb(initial: Map<unknown, any[]>, options: { publishedOnly?: boolean; reportCardScope?: { schoolId: number; classId: number; academicYearId: number; termId: number } } = {}) {
  let nextId = 100;
  const rowsFor = (table?: unknown) => {
    const rows = initial.get(table) ?? [];
    if (table !== reportCards) return rows;
    const scoped = options.reportCardScope ? rows.filter(row => row.schoolId === options.reportCardScope?.schoolId && row.classId === options.reportCardScope?.classId && row.academicYearId === options.reportCardScope?.academicYearId && row.termId === options.reportCardScope?.termId) : rows;
    return options.publishedOnly ? scoped.filter(row => Boolean(row.publishedAt)) : scoped;
  };
  const query = (table?: unknown): any => ({
    from: (next: unknown) => query(next),
    innerJoin: () => query(table),
    leftJoin: () => query(table),
    orderBy: () => query(table),
    where: () => query(table),
    limit: async () => rowsFor(table),
    then: (resolve: any, reject?: any) => Promise.resolve(rowsFor(table)).then(resolve, reject),
  });
  return {
    select: () => query(),
    insert: () => ({
      values: async (values: any) => {
        const table = values.resultSnapshot !== undefined ? reportCards : values.reportType !== undefined ? reportExports : users;
        const row = { ...values, id: values.id ?? nextId++ };
        initial.set(table, [...(initial.get(table) ?? []), row]);
      },
    }),
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async () => {
          const rows = initial.get(table) ?? [];
          const scopedIds = new Set(rowsFor(table).map(row => row.id));
          initial.set(table, rows.map(row => scopedIds.has(row.id) ? { ...row, ...values } : row));
        },
      }),
    }),
  };
}

function context(role: "student" | "teacher" | "class_teacher" | "principal" | "parent", userId: number) {
  return {
    user: { id: userId, openId: `report-card-${userId}`, name: "Report Card Test", email: "report@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  } satisfies TrpcContext;
}

const school = { id: 1, name: "Test School", code: "TST", phone: "+254700000000", email: "office@test.school", address: "Nairobi", logoKey: "schools/test-logo.png", gradeScale: null };
const learner = { id: 11, schoolId: 1, userId: 101, admissionNo: "ADM-0042", firstName: "Amina", middleName: null, lastName: "Otieno", currentClassId: 41, status: "active" };
const schoolClass = { id: 41, schoolId: 1, form: "Form 2", stream: "East", classTeacherId: null };
const academicYear = { id: 21, schoolId: 1, name: "2026" };
const term = { id: 31, academicYearId: 21, name: "Term 1" };
const subject = { id: 51, schoolId: 1, code: "MAT", name: "Mathematics" };
const assessment = { id: 61, schoolId: 1, academicYearId: 21, termId: 31, classId: 41, title: "Mid-term examination", assessmentDate: new Date("2026-05-20T00:00:00.000Z"), maxMarks: "100" };
const mark = { id: 71, assessmentId: 61, studentId: 11, subjectId: 51, score: "82", grade: "A", gradePoints: 12, comment: "Strong work", subject: "Mathematics", subjectCode: "MAT", assessment: "Mid-term examination", assessmentDate: assessment.assessmentDate, maxMarks: assessment.maxMarks };

function tablesWithMarks() {
  return new Map<unknown, any[]>([
    [schools, [school]],
    [students, [learner]],
    [schoolClasses, [schoolClass]],
    [teachers, []],
    [teacherAssignments, []],
    [academicYears, [academicYear]],
    [terms, [term]],
    [subjects, [subject]],
    [assessments, [assessment]],
    [marks, [mark]],
    [reportCards, []],
    [reportExports, []],
    [users, [{ id: 101, role: "student", name: "Amina Otieno" }]],
  ]);
}

describe("report-card procedures", () => {
  it("allows a principal to create a school-scoped report card from term marks and audits it", async () => {
    const tables = tablesWithMarks();
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const result = await appRouter.createCaller(context("principal", 201)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41, teacherComment: "Keep building on this progress." });

    expect(result).toMatchObject({ success: true, updated: false });
    const saved = tables.get(reportCards)?.[0];
    expect(saved).toMatchObject({ schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41, overallGrade: "A", teacherComment: "Keep building on this progress." });
    expect(saved.resultSnapshot).toEqual([expect.objectContaining({ subject: "Mathematics", subjectCode: "MAT", score: 82, maxMarks: 100, grade: "A", gradePoints: 12 })]);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.created", actorUserId: 201, entityType: "reportCard", entityId: saved.id, metadata: expect.objectContaining({ studentId: 11, termId: 31, subjectCount: 1, overallGrade: "A" }) }));
  });

  it("keeps draft report cards hidden from learners until the batch is published", async () => {
    const tables = tablesWithMarks();
    tables.set(reportCards, [{ id: 100, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41, publishedAt: null }, { id: 101, schoolId: 1, studentId: 11, academicYearId: 21, termId: 32, classId: 41, publishedAt: new Date("2026-06-01T00:00:00.000Z") }]);
    dbState.current = fakeDb(tables, { publishedOnly: true });

    const result = await appRouter.createCaller(context("student", 101)).school.reportCards.mine();

    expect(result.reportCards).toHaveLength(1);
    expect(result.reportCards[0].id).toBe(101);
  });

  it("lets only the linked student retrieve and export a report card with school metadata", async () => {
    const tables = tablesWithMarks();
    tables.set(reportCards, [{ id: 100, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41, title: "Term 1 Report Card", studentFirstName: "Amina", studentLastName: "Otieno", admissionNo: "ADM-0042", academicYear: "2026", term: "Term 1", form: "Form 2", stream: "East", resultSnapshot: [{ subjectId: 51, subject: "Mathematics", subjectCode: "MAT", score: 82, maxMarks: 100, grade: "A", gradePoints: 12, assessment: "Mid-term examination", assessmentDate: "2026-05-20", comment: "Strong work" }], totalMarks: "82", averagePercentage: "82", meanPoints: "12", overallGrade: "A", teacherComment: null, publishedAt: new Date("2026-06-01T00:00:00.000Z") }]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const result = await appRouter.createCaller(context("student", 101)).school.reportCards.mine();
    expect(result.school).toMatchObject({ name: "Test School", code: "TST", logoUrl: "/manus-storage/schools/test-logo.png" });
    expect(result.reportCards).toHaveLength(1);
    expect(result.reportCards[0]).toMatchObject({ studentId: 11, overallGrade: "A", term: "Term 1" });

    const exported = await appRouter.createCaller(context("student", 101)).school.reportCards.exportPdf({ reportCardId: 100 });
    expect(exported.success).toBe(true);
    expect(tables.get(reportExports)?.[0]).toMatchObject({ reportType: "student_report_card", format: "pdf", filters: { reportCardId: "100", studentId: "11" } });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.report_card_generated", actorUserId: 101, entityType: "reportCard", entityId: 100, metadata: { studentId: 11, format: "pdf" } }));
  });

  it("allows assigned teachers and class teachers to create or update only permitted cards", async () => {
    const tables = tablesWithMarks();
    tables.set(teachers, [{ id: 91, schoolId: 1, userId: 401 }]);
    tables.set(teacherAssignments, [{ id: 81, teacherId: 91, classId: 41, subjectId: 51 }]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const teacherResult = await appRouter.createCaller(context("teacher", 401)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 });
    expect(teacherResult).toMatchObject({ success: true, updated: false });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.created", actorUserId: 401 }));

    tables.set(reportCards, [{ id: 100, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41 }]);
    tables.set(schoolClasses, [{ ...schoolClass, classTeacherId: 92 }]);
    tables.set(teachers, [{ id: 92, schoolId: 1, userId: 402 }]);
    tables.set(teacherAssignments, []);
    vi.mocked(writeAuditLog).mockClear();

    const classTeacherResult = await appRouter.createCaller(context("class_teacher", 402)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41, teacherComment: "Updated by the class teacher." });
    expect(classTeacherResult).toMatchObject({ success: true, updated: true, reportCardId: 100 });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.updated", actorUserId: 402, entityId: 100 }));

    tables.set(teachers, [{ id: 93, schoolId: 1, userId: 403 }]);
    tables.set(teacherAssignments, []);
    await expect(appRouter.createCaller(context("teacher", 403)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 })).rejects.toThrow("not assigned");
    await expect(appRouter.createCaller(context("parent", 404)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 })).rejects.toThrow("role is not permitted");
  });

  it("rejects report-card creation when marks, learner class, or term-year scope is invalid", async () => {
    const noMarks = tablesWithMarks();
    noMarks.set(marks, []);
    dbState.current = fakeDb(noMarks);
    await expect(appRouter.createCaller(context("principal", 201)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 })).rejects.toThrow("at least one mark");
    expect(noMarks.get(reportCards)).toHaveLength(0);

    const wrongClass = tablesWithMarks();
    wrongClass.set(students, [{ ...learner, currentClassId: 99 }]);
    dbState.current = fakeDb(wrongClass);
    await expect(appRouter.createCaller(context("principal", 201)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 })).rejects.toThrow("must belong to the selected class");
    expect(wrongClass.get(reportCards)).toHaveLength(0);

    const wrongTermYear = tablesWithMarks();
    wrongTermYear.set(terms, []);
    dbState.current = fakeDb(wrongTermYear);
    await expect(appRouter.createCaller(context("principal", 201)).school.reportCards.create({ studentId: 11, academicYearId: 21, termId: 99, classId: 41 })).rejects.toThrow("selected academic year");
    expect(wrongTermYear.get(reportCards)).toHaveLength(0);
  });

  it("returns an unsaved teacher preview without export or audit side effects", async () => {
    const tables = tablesWithMarks();
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const result = await appRouter.createCaller(context("principal", 201)).school.reportCards.preview({ studentId: 11, academicYearId: 21, termId: 31, classId: 41, teacherComment: "Preview comment" });

    expect(result).toMatchObject({ title: "Term 1 Report Card", overallGrade: "A", teacherComment: "Preview comment", student: { id: 11, admissionNo: "ADM-0042" }, classRecord: { form: "Form 2", stream: "East" } });
    expect(result.resultSnapshot).toEqual([expect.objectContaining({ subject: "Mathematics", score: 82, grade: "A" })]);
    expect(tables.get(reportCards)).toHaveLength(0);
    expect(tables.get(reportExports)).toHaveLength(0);
    expect(writeAuditLog).not.toHaveBeenCalled();

    await expect(appRouter.createCaller(context("teacher", 301)).school.reportCards.preview({ studentId: 11, academicYearId: 21, termId: 31, classId: 41 })).rejects.toThrow("not linked to a teacher profile");
  });

  it("generates a class batch with per-learner skip results, upserts idempotently, and audits one summary", async () => {
    const secondLearner = { ...learner, id: 12, userId: 102, admissionNo: "ADM-0043", firstName: "Brian", lastName: "Kiptoo" };
    const tables = tablesWithMarks();
    tables.set(students, [learner, secondLearner]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const first = await appRouter.createCaller(context("principal", 201)).school.reportCards.batchGenerate({ classId: 41, academicYearId: 21, termId: 31, teacherComment: "Class progress note" });

    expect(first).toMatchObject({ success: true, created: 1, updated: 0, skipped: 1 });
    expect(first.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentId: 11, status: "created" }),
      expect.objectContaining({ studentId: 12, status: "skipped", reason: "No marks entered for this learner." }),
    ]));
    expect(tables.get(reportCards)).toHaveLength(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.batch_generated", actorUserId: 201, metadata: expect.objectContaining({ totalLearners: 2, created: 1, updated: 0, skipped: 1 }) }));

    vi.mocked(writeAuditLog).mockClear();
    const second = await appRouter.createCaller(context("principal", 201)).school.reportCards.batchGenerate({ classId: 41, academicYearId: 21, termId: 31, teacherComment: "Updated class progress note" });

    expect(second).toMatchObject({ success: true, created: 0, updated: 1, skipped: 1 });
    expect(tables.get(reportCards)?.[0].teacherComment).toBe("Updated class progress note");
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.batch_generated", metadata: expect.objectContaining({ totalLearners: 2, created: 0, updated: 1, skipped: 1 }) }));
  });

  it("allows an assigned teacher to batch-generate and rejects batch generation by a parent", async () => {
    const secondLearner = { ...learner, id: 12, userId: 102, admissionNo: "ADM-0043", firstName: "Brian", lastName: "Kiptoo" };
    const tables = tablesWithMarks();
    tables.set(students, [learner, secondLearner]);
    tables.set(teachers, [{ id: 91, schoolId: 1, userId: 401 }]);
    tables.set(teacherAssignments, [{ id: 81, teacherId: 91, classId: 41, subjectId: 51 }]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const result = await appRouter.createCaller(context("teacher", 401)).school.reportCards.batchGenerate({ classId: 41, academicYearId: 21, termId: 31 });
    expect(result).toMatchObject({ success: true, created: 1, updated: 0, skipped: 1 });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.batch_generated", actorUserId: 401 }));
    await expect(appRouter.createCaller(context("parent", 404)).school.reportCards.batchGenerate({ classId: 41, academicYearId: 21, termId: 31 })).rejects.toThrow("role is not permitted");
  });

  it("publishes and unpublishes a reviewed batch with scoped audit summaries", async () => {
    const tables = tablesWithMarks();
    tables.set(reportCards, [
      { id: 100, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41, publishedAt: null },
      { id: 101, schoolId: 1, studentId: 12, academicYearId: 21, termId: 31, classId: 41, publishedAt: null },
    ]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const published = await appRouter.createCaller(context("teacher", 401)).school.reportCards.publishBatch({ classId: 41, academicYearId: 21, termId: 31 }).catch(() => null);
    expect(published).toBeNull();

    tables.set(teachers, [{ id: 91, schoolId: 1, userId: 401 }]);
    tables.set(teacherAssignments, [{ id: 81, teacherId: 91, classId: 41, subjectId: 51 }]);
    const released = await appRouter.createCaller(context("teacher", 401)).school.reportCards.publishBatch({ classId: 41, academicYearId: 21, termId: 31 });
    expect(released).toMatchObject({ success: true, published: 2 });
    expect(tables.get(reportCards)?.every(row => row.publishedAt instanceof Date)).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.batch_published", actorUserId: 401, metadata: expect.objectContaining({ classId: 41, termId: 31, count: 2 }) }));

    const withdrawn = await appRouter.createCaller(context("teacher", 401)).school.reportCards.unpublishBatch({ classId: 41, academicYearId: 21, termId: 31 });
    expect(withdrawn).toMatchObject({ success: true, unpublished: 2 });
    expect(tables.get(reportCards)?.every(row => row.publishedAt === null)).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "report_card.batch_unpublished", actorUserId: 401, metadata: expect.objectContaining({ classId: 41, termId: 31, count: 2 }) }));
  });

  it("does not publish or unpublish report cards outside the selected school and class-term scope", async () => {
    const tables = tablesWithMarks();
    tables.set(teachers, [{ id: 91, schoolId: 1, userId: 401 }]);
    tables.set(teacherAssignments, [{ id: 81, teacherId: 91, classId: 41, subjectId: 51 }]);
    const target = { id: 100, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 41, publishedAt: null };
    const otherClass = { id: 101, schoolId: 1, studentId: 11, academicYearId: 21, termId: 31, classId: 99, publishedAt: new Date("2026-06-02T00:00:00.000Z") };
    const otherSchool = { id: 102, schoolId: 2, studentId: 88, academicYearId: 21, termId: 31, classId: 41, publishedAt: new Date("2026-06-03T00:00:00.000Z") };
    tables.set(reportCards, [target, otherClass, otherSchool]);
    dbState.current = fakeDb(tables, { reportCardScope: { schoolId: 1, classId: 41, academicYearId: 21, termId: 31 } });

    const result = await appRouter.createCaller(context("teacher", 401)).school.reportCards.publishBatch({ classId: 41, academicYearId: 21, termId: 31 });

    expect(result).toMatchObject({ success: true, published: 1 });
    expect(tables.get(reportCards)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 100, publishedAt: expect.any(Date) }), expect.objectContaining({ id: 101, publishedAt: expect.any(Date) }), expect.objectContaining({ id: 102, publishedAt: expect.any(Date) })]));

    const withdrawn = await appRouter.createCaller(context("teacher", 401)).school.reportCards.unpublishBatch({ classId: 41, academicYearId: 21, termId: 31 });
    expect(withdrawn).toMatchObject({ success: true, unpublished: 1 });
    expect(tables.get(reportCards)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 100, publishedAt: null }), expect.objectContaining({ id: 101, publishedAt: expect.any(Date) }), expect.objectContaining({ id: 102, publishedAt: expect.any(Date) })]));
  });

  it("returns an idempotent empty result when there is no batch to publish or unpublish", async () => {
    const tables = tablesWithMarks();
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();

    const publish = await appRouter.createCaller(context("principal", 201)).school.reportCards.publishBatch({ classId: 41, academicYearId: 21, termId: 31 });
    const unpublish = await appRouter.createCaller(context("principal", 201)).school.reportCards.unpublishBatch({ classId: 41, academicYearId: 21, termId: 31 });
    expect(publish).toMatchObject({ success: true, published: 0 });
    expect(unpublish).toMatchObject({ success: true, unpublished: 0 });
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("denies report-card retrieval and export to non-student roles", async () => {
    const tables = tablesWithMarks();
    tables.set(reportCards, [{ id: 100, schoolId: 1, studentId: 11 }]);
    dbState.current = fakeDb(tables);

    await expect(appRouter.createCaller(context("teacher", 301)).school.reportCards.mine()).rejects.toThrow("not permitted");
    await expect(appRouter.createCaller(context("teacher", 301)).school.reportCards.exportPdf({ reportCardId: 100 })).rejects.toThrow("not permitted");
  });
});
