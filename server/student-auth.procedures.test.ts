import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "@shared/const";
import { assessments, marks, schools, studentCredentials, students, subjects, users } from "../drizzle/schema";

const dbState = vi.hoisted(() => ({ current: null as any }));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbState.current),
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "student-session-token"),
  },
}));

import { writeAuditLog } from "./db";
import { appRouter } from "./routers";
import { hashStudentSecret } from "./student-auth";

function fakeDb(initial: Map<unknown, any[]>) {
  let nextId = 100;
  const query = (table?: unknown): any => ({
    from: (next: unknown) => query(next),
    innerJoin: () => query(table),
    leftJoin: () => query(table),
    orderBy: () => query(table),
    where: () => query(table),
    limit: async () => initial.get(table) ?? [],
    then: (resolve: any, reject?: any) => Promise.resolve(initial.get(table) ?? []).then(resolve, reject),
  });
  return {
    select: () => query(),
    insert: () => ({
      values: async (values: any) => {
        const table = values.studentId !== undefined && (values.passwordHash !== undefined || values.activationCodeHash !== undefined) ? studentCredentials : users;
        const row = { ...values, id: values.id ?? nextId++ };
        initial.set(table, [...(initial.get(table) ?? []), row]);
      },
    }),
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async () => {
          const rows = initial.get(table) ?? [];
          initial.set(table, rows.map(row => ({ ...row, ...values })));
        },
      }),
    }),
  };
}

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"];
}

function context(role: "super_admin" | "principal" | "parent" | "student", res = response(), userId = 1): TrpcContext {
  return {
    user: { id: userId, openId: "student-auth-test", name: "Test User", email: "test@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res,
  };
}

const school = { id: 1, name: "Test School", code: "TST" };
const student = { id: 11, schoolId: 1, userId: null, admissionNo: "ADM-0042", firstName: "Amina", middleName: null, lastName: "Otieno", gender: "female", dateOfBirth: null, phone: null, email: "amina@example.com", currentClassId: null, status: "active", enrolledOn: "2026-01-01", createdAt: new Date(), updatedAt: new Date() };

describe("student authentication procedures", () => {
  it("issues a short-lived activation code only to leadership", async () => {
    dbState.current = fakeDb(new Map([[schools, [school]], [students, [student]], [studentCredentials, []], [users, []]]));
    vi.mocked(writeAuditLog).mockClear();
    const result = await appRouter.createCaller(context("super_admin")).auth.issueStudentActivationCode({ studentId: student.id });
    expect(result.activationCode).toMatch(/^[A-F0-9]{12}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect((dbState.current as any)).toBeTruthy();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.activation_code_issued", schoolId: 1, entityId: 11 }));
    await expect(appRouter.createCaller(context("parent")).auth.issueStudentActivationCode({ studentId: student.id })).rejects.toThrow();
  });

  it("lets the learner set a password, links a student-role user, and receives the normal session cookie", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student }]], [studentCredentials, []], [users, []]]);
    dbState.current = fakeDb(tables);
    const issue = await appRouter.createCaller(context("principal")).auth.issueStudentActivationCode({ studentId: student.id });
    const activate = await appRouter.createCaller(context("parent")).auth.activateStudentPassword({ admissionNo: " adm-0042 ", activationCode: issue.activationCode, password: "LearnerPass42", confirmPassword: "LearnerPass42" });
    expect(activate).toEqual({ success: true });
    const credential = tables.get(studentCredentials)?.[0];
    expect(credential.passwordHash).toMatch(/^scrypt\$/);
    expect(credential.passwordHash).not.toContain("LearnerPass42");
    const linkedUser = tables.get(users)?.[0];
    expect(linkedUser.role).toBe("student");
    const res = response();
    const result = await appRouter.createCaller(context("parent", res)).auth.loginStudent({ admissionNo: "ADM-0042", password: "LearnerPass42" });
    expect(result.student).toMatchObject({ id: 11, admissionNo: "ADM-0042", name: "Amina Otieno" });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "student-session-token", expect.objectContaining({ httpOnly: true, secure: true, maxAge: expect.any(Number) }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.login_succeeded", actorUserId: linkedUser.id }));
  });

  it("returns only results linked to the authenticated learner", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [marks, [{ studentId: 11, subjectId: 21, assessmentId: 31, score: "84", grade: "A", gradePoints: "12", admissionNo: "ADM-0042", firstName: "Amina", lastName: "Otieno", subject: "Mathematics", subjectCode: "MAT", assessment: "Term 1 Exam", assessmentDate: new Date("2026-04-20") }]], [subjects, [{ id: 21, name: "Mathematics", code: "MAT" }]], [assessments, [{ id: 31, title: "Term 1 Exam", assessmentDate: new Date("2026-04-20") }]], [studentCredentials, []], [users, []]]);
    dbState.current = fakeDb(tables);
    const result = await appRouter.createCaller(context("student", response(), 101)).school.students.results();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ studentId: 11, admissionNo: "ADM-0042", subject: "Mathematics", assessment: "Term 1 Exam", score: "84", grade: "A" });
    tables.set(students, []);
    expect(await appRouter.createCaller(context("student", response(), 101)).school.students.results()).toEqual([]);
  });

  it("rejects invalid passwords generically and records a failed-attempt audit event", async () => {
    const passwordHash = await hashStudentSecret("LearnerPass42");
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash, activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    await expect(appRouter.createCaller(context("parent")).auth.loginStudent({ admissionNo: "ADM-0042", password: "WrongPass42" })).rejects.toThrow("Invalid admission number or password.");
    expect(tables.get(studentCredentials)?.[0].failedAttempts).toBe(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.login_failed", metadata: expect.objectContaining({ failedAttempts: 1 }) }));
  });
});
