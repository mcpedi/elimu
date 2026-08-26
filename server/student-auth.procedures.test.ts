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
import { hashStudentSecret, verifyStudentSecret } from "./student-auth";

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

function context(role: "parent" | "student" | "teacher", res = response(), userId = 1): TrpcContext {
  return {
    user: { id: userId, openId: "student-auth-test", name: "Test User", email: "test@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res,
  };
}

const school = { id: 1, name: "Test School", code: "TST" };
const student = { id: 11, schoolId: 1, userId: null, admissionNo: "ADM-0042", firstName: "Amina", middleName: null, lastName: "Otieno", gender: "female", dateOfBirth: null, phone: null, email: "amina@example.com", currentClassId: null, status: "active", enrolledOn: "2026-01-01", createdAt: new Date(), updatedAt: new Date() };

describe("student authentication procedures", () => {
  it("uses the learner name as username and hashes the admission number as the initial password", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student }]], [studentCredentials, []], [users, []]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    const res = response();
    const result = await appRouter.createCaller(context("parent", res)).auth.loginStudent({ username: "  AMINA   OTIENO ", password: "adm-0042" });
    expect(result.student).toMatchObject({ id: 11, admissionNo: "ADM-0042", name: "Amina Otieno" });
    expect(tables.get(studentCredentials)?.[0].passwordHash).toMatch(/^scrypt\$/);
    expect(tables.get(studentCredentials)?.[0].passwordHash).not.toContain("ADM-0042");
    expect(tables.get(users)?.[0].role).toBe("student");
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "student-session-token", expect.objectContaining({ httpOnly: true, secure: true, maxAge: expect.any(Number) }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.login_succeeded", actorUserId: tables.get(users)?.[0].id, metadata: expect.objectContaining({ passwordMode: "admission_number" }) }));
  });

  it("blocks ambiguous learner-name usernames and records the lookup event", async () => {
    const duplicate = { ...student, id: 12, admissionNo: "ADM-0099" };
    dbState.current = fakeDb(new Map<unknown, any[]>([[schools, [school]], [students, [student, duplicate]], [studentCredentials, []], [users, []]]));
    vi.mocked(writeAuditLog).mockClear();
    await expect(appRouter.createCaller(context("student")).auth.loginStudent({ username: "Amina Otieno", password: "ADM-0042" })).rejects.toThrow("learner name is shared");
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.login_ambiguous_username", metadata: { username: "amina otieno" } }));
  });

  it("migrates legacy activation credentials to the admission-number password model", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash: await hashStudentSecret("OldPassword42"), passwordMode: "legacy_activation", activationCodeHash: "legacy-code", activationCodeExpiresAt: new Date(Date.now() + 60_000), failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    const result = await appRouter.createCaller(context("student", response(), 101)).auth.loginStudent({ username: "Amina Otieno", password: "ADM-0042" });
    expect(result.success).toBe(true);
    expect(tables.get(studentCredentials)?.[0].passwordMode).toBe("admission_number");
    expect(tables.get(studentCredentials)?.[0].activationCodeHash).toBeNull();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.password_model_migrated", metadata: expect.objectContaining({ from: "legacy_activation", to: "admission_number" }) }));
  });

  it("rejects invalid admission-number passwords generically and records a failed attempt", async () => {
    const passwordHash = await hashStudentSecret("ADM-0042");
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash, activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    await expect(appRouter.createCaller(context("student", response(), 101)).auth.loginStudent({ username: "Amina Otieno", password: "WRONG" })).rejects.toThrow("Invalid learner name or admission number.");
    expect(tables.get(studentCredentials)?.[0].failedAttempts).toBe(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.login_failed", metadata: expect.objectContaining({ failedAttempts: 1 }) }));
  });

  it("changes a student password, preserves the session, and audits the change", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash: await hashStudentSecret("ADM-0042"), passwordMode: "admission_number", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    const res = response();
    const result = await appRouter.createCaller(context("student", res, 101)).auth.changeStudentPassword({ currentPassword: "ADM-0042", newPassword: "LearnerSafe42!", confirmPassword: "LearnerSafe42!" });
    expect(result.success).toBe(true);
    const saved = tables.get(studentCredentials)?.[0];
    expect(saved.passwordMode).toBe("custom");
    expect(await verifyStudentSecret("LearnerSafe42!", saved.passwordHash)).toBe(true);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.password_changed", actorUserId: 101, entityId: 11, metadata: expect.objectContaining({ passwordMode: "custom", sessionPreserved: true }) }));
  });

  it("accepts a normalized admission-number variant when changing the initial password", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash: await hashStudentSecret("ADM-0042"), passwordMode: "admission_number", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    const result = await appRouter.createCaller(context("student", response(), 101)).auth.changeStudentPassword({ currentPassword: "  adm-0042 ", newPassword: "LearnerSafe99!", confirmPassword: "LearnerSafe99!" });
    expect(result.success).toBe(true);
    const saved = tables.get(studentCredentials)?.[0];
    expect(saved.passwordMode).toBe("custom");
    expect(await verifyStudentSecret("LearnerSafe99!", saved.passwordHash)).toBe(true);
  });

  it("rejects a wrong current password and increments the learner credential failure count", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash: await hashStudentSecret("ADM-0042"), passwordMode: "admission_number", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    vi.mocked(writeAuditLog).mockClear();
    await expect(appRouter.createCaller(context("student", response(), 101)).auth.changeStudentPassword({ currentPassword: "wrong-current", newPassword: "LearnerSafe42!", confirmPassword: "LearnerSafe42!" })).rejects.toThrow("Current password is incorrect.");
    expect(tables.get(studentCredentials)?.[0].failedAttempts).toBe(1);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "student.password_change_failed", metadata: expect.objectContaining({ reason: "current_password_invalid", failedAttempts: 1 }) }));
  });

  it("rejects password reuse and denies password changes to non-student roles", async () => {
    const tables = new Map<unknown, any[]>([[schools, [school]], [students, [{ ...student, userId: 101 }]], [studentCredentials, [{ id: 1, studentId: 11, passwordHash: await hashStudentSecret("LearnerSafe42!"), passwordMode: "custom", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }]], [users, [{ id: 101, openId: "student_11", role: "student", name: "Amina Otieno" }]]]);
    dbState.current = fakeDb(tables);
    await expect(appRouter.createCaller(context("student", response(), 101)).auth.changeStudentPassword({ currentPassword: "LearnerSafe42!", newPassword: "LearnerSafe42!", confirmPassword: "LearnerSafe42!" })).rejects.toThrow("different");
    await expect(appRouter.createCaller(context("parent", response(), 101)).auth.changeStudentPassword({ currentPassword: "LearnerSafe42!", newPassword: "AnotherSafe42!", confirmPassword: "AnotherSafe42!" })).rejects.toThrow("Only learner accounts");
  });

  it("denies learner-only results to unauthorized roles", async () => {
    dbState.current = fakeDb(new Map<unknown, any[]>([[schools, [school]], [students, []], [studentCredentials, []], [users, []]]));
    await expect(appRouter.createCaller(context("teacher")).school.students.results()).rejects.toThrow("not permitted");
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
});
