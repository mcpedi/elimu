import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { schools, studentCredentials, students, users } from "../drizzle/schema";
import { createStudentResetCode, hashStudentSecret, normalizeStudentIdentifier, normalizeStudentUsernameInput, STUDENT_LOGIN_LOCK_MS, STUDENT_LOGIN_MAX_ATTEMPTS, STUDENT_RESET_TTL_MS, verifyStudentSecret } from "./student-auth";
import { getDb, writeAuditLog } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { sdk } from "./_core/sdk";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { schoolRouter } from "./routers/school";
import { requireRole } from "./permissions";

const studentLoginPasswordSchema = z.string().trim().min(1, "Enter your admission number as the password.").max(128);
const studentUsernameSchema = z.string().trim().min(2, "Enter your full name.").max(160, "Name is too long.");
const schoolCodeSchema = z.string().trim().min(2, "Enter your school code.").max(24).transform(value => value.toUpperCase());
const studentCurrentPasswordSchema = z.string().min(1, "Enter your current password.").max(128);
const studentNewPasswordSchema = z.string().min(8, "Use at least 8 characters.").max(128, "Password is too long.");
const studentResetCodeSchema = z.string().trim().min(8, "Enter the reset code from the school office.").max(32);
const studentIdSchema = z.number().int().positive();
const STUDENT_LOGIN_ERROR = "Invalid learner name or admission number.";

async function getStudentLoginRecord(schoolCode: string, username: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  const schoolRows = await db.select().from(schools).where(eq(schools.code, schoolCode)).limit(1);
  const school = schoolRows.find(row => row.code === schoolCode);
  if (!school) throw new TRPCError({ code: "UNAUTHORIZED", message: STUDENT_LOGIN_ERROR });
  const normalizedUsername = normalizeStudentUsernameInput(username);
  const candidates = await db.select().from(students).where(and(eq(students.schoolId, school.id), sql`lower(trim(concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}))) = ${normalizedUsername}`)).limit(2);
  if (candidates.length > 1) {
    await writeAuditLog({ schoolId: school.id, action: "student.login_ambiguous_username", entityType: "student_login", metadata: { username: normalizedUsername } });
    throw new TRPCError({ code: "CONFLICT", message: "This learner name is shared by more than one record. Ask the school office for a unique username." });
  }
  return { db, school, student: candidates[0], username: normalizedUsername };
}

async function ensureStudentUser(db: Awaited<ReturnType<typeof getDb>>, student: typeof students.$inferSelect) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  let user = student.userId ? (await db.select().from(users).where(eq(users.id, student.userId)).limit(1))[0] : undefined;
  if (user && user.role !== "student") throw new TRPCError({ code: "CONFLICT", message: "This learner is linked to a non-student account. Ask an administrator to review the link." });
  if (!user) {
    const openId = `student_${student.id}`;
    user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
    if (user && user.role !== "student") throw new TRPCError({ code: "CONFLICT", message: "This learner login identifier is already in use." });
    if (!user) {
      await db.insert(users).values({ openId, schoolId: student.schoolId, name: `${student.firstName} ${student.lastName}`, email: student.email, loginMethod: "student_password", role: "student" });
      user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
    }
    if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the learner login account." });
    if (user.schoolId && user.schoolId !== student.schoolId) throw new TRPCError({ code: "CONFLICT", message: "This learner account is linked to a different school." });
    if (!user.schoolId) await db.update(users).set({ schoolId: student.schoolId }).where(eq(users.id, user.id));
    if (student.userId !== user.id) await db.update(students).set({ userId: user.id }).where(eq(students.id, student.id));
  }
  return user;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginStudent: publicProcedure.input(z.object({ schoolCode: schoolCodeSchema, username: studentUsernameSchema, password: studentLoginPasswordSchema })).mutation(async ({ ctx, input }) => {
      const { db, school, student, username } = await getStudentLoginRecord(input.schoolCode, input.username);
      if (!student || student.status === "inactive" || student.status === "transferred") {
        await writeAuditLog({ schoolId: school.id, action: "student.login_failed", entityType: "student_login", metadata: { username, reason: "unknown_or_inactive_learner" } });
        throw new TRPCError({ code: "UNAUTHORIZED", message: STUDENT_LOGIN_ERROR });
      }
      let [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      const migratedLegacyPassword = credential?.passwordMode === "legacy_activation";
      if (!credential?.passwordHash || migratedLegacyPassword) {
        const defaultPasswordHash = await hashStudentSecret(normalizeStudentIdentifier(student.admissionNo));
        if (credential) await db.update(studentCredentials).set({ passwordHash: defaultPasswordHash, passwordMode: "admission_number", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }).where(eq(studentCredentials.studentId, student.id));
        else await db.insert(studentCredentials).values({ studentId: student.id, passwordHash: defaultPasswordHash, passwordMode: "admission_number", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null });
        [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.password_model_migrated", entityType: "student", entityId: student.id, metadata: { username, admissionNo: student.admissionNo, from: migratedLegacyPassword ? "legacy_activation" : "uninitialized", to: "admission_number" } });
      }
      if (!credential) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to prepare the learner login account." });
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Try again in 15 minutes." });
      const validPassword = await verifyStudentSecret(input.password, credential.passwordHash) || await verifyStudentSecret(normalizeStudentIdentifier(input.password), credential.passwordHash);
      if (!validPassword) {
        const failedAttempts = Number(credential.failedAttempts ?? 0) + 1;
        const lockedUntil = failedAttempts >= STUDENT_LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + STUDENT_LOGIN_LOCK_MS) : null;
        await db.update(studentCredentials).set({ failedAttempts, lockedUntil }).where(eq(studentCredentials.studentId, student.id));
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.login_failed", entityType: "student", entityId: student.id, metadata: { username, failedAttempts, locked: Boolean(lockedUntil) } });
        throw new TRPCError({ code: "UNAUTHORIZED", message: STUDENT_LOGIN_ERROR });
      }
      const user = await ensureStudentUser(db, student);
      const signedInAt = new Date();
      await db.update(studentCredentials).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: signedInAt }).where(eq(studentCredentials.studentId, student.id));
      await db.update(users).set({ lastSignedIn: signedInAt, name: `${student.firstName} ${student.lastName}`, role: "student", loginMethod: "student_password" }).where(eq(users.id, user.id));
      const sessionToken = await sdk.createSessionToken(user.openId, { name: `${student.firstName} ${student.lastName}`, expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      await writeAuditLog({ schoolId: school.id, actorUserId: user.id, action: "student.login_succeeded", entityType: "student", entityId: student.id, metadata: { username, admissionNo: student.admissionNo, passwordMode: "admission_number", migratedLegacyPassword } });
      return { success: true, student: { id: student.id, admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}` } } as const;
    }),
    issueStudentPasswordResetCode: protectedProcedure.input(z.object({ studentId: studentIdSchema })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
      const schoolRows = ctx.user.schoolId ? await db.select().from(schools).where(eq(schools.id, ctx.user.schoolId)).limit(1) : [];
      const school = schoolRows.find(row => row.id === ctx.user.schoolId);
      const [student] = school ? await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1) : [];
      if (!school || !student || student.status === "inactive" || student.status === "transferred") throw new TRPCError({ code: "NOT_FOUND", message: "Active learner not found in this school." });
      const resetCode = createStudentResetCode();
      const resetCodeHash = await hashStudentSecret(resetCode);
      const resetExpiresAt = new Date(Date.now() + STUDENT_RESET_TTL_MS);
      const [existing] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      if (existing) await db.update(studentCredentials).set({ activationCodeHash: resetCodeHash, activationCodeExpiresAt: resetExpiresAt, failedAttempts: 0, lockedUntil: null }).where(eq(studentCredentials.studentId, student.id));
      else await db.insert(studentCredentials).values({ studentId: student.id, passwordHash: null, passwordMode: "legacy_activation", activationCodeHash: resetCodeHash, activationCodeExpiresAt: resetExpiresAt, failedAttempts: 0, lockedUntil: null });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.password_reset_code_issued", entityType: "student", entityId: student.id, metadata: { admissionNo: student.admissionNo, expiresAt: resetExpiresAt.toISOString(), delivery: "school_office" } });
      return { success: true, resetCode, expiresAt: resetExpiresAt, student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo } } as const;
    }),
    resetStudentPassword: publicProcedure.input(z.object({ schoolCode: schoolCodeSchema, username: studentUsernameSchema, resetCode: studentResetCodeSchema, newPassword: studentNewPasswordSchema, confirmPassword: studentNewPasswordSchema })).mutation(async ({ input }) => {
      if (input.newPassword !== input.confirmPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match." });
      const { db, school, student, username } = await getStudentLoginRecord(input.schoolCode, input.username);
      if (!student || student.status === "inactive" || student.status === "transferred") {
        await writeAuditLog({ schoolId: school.id, action: "student.password_reset_failed", entityType: "student_reset", metadata: { username, reason: "unknown_or_inactive_learner" } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reset code invalid or expired." });
      }
      const [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      if (!credential?.activationCodeHash || !credential.activationCodeExpiresAt || credential.activationCodeExpiresAt.getTime() <= Date.now()) {
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.password_reset_failed", entityType: "student", entityId: student.id, metadata: { username, reason: "reset_code_missing_or_expired" } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reset code invalid or expired." });
      }
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.password_reset_failed", entityType: "student", entityId: student.id, metadata: { username, reason: "reset_locked" } });
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Try again in 15 minutes." });
      }
      const validCode = await verifyStudentSecret(input.resetCode.toUpperCase(), credential.activationCodeHash);
      if (!validCode) {
        const failedAttempts = Number(credential.failedAttempts ?? 0) + 1;
        const lockedUntil = failedAttempts >= STUDENT_LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + STUDENT_LOGIN_LOCK_MS) : null;
        await db.update(studentCredentials).set({ failedAttempts, lockedUntil }).where(eq(studentCredentials.studentId, student.id));
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.password_reset_failed", entityType: "student", entityId: student.id, metadata: { username, reason: "reset_code_invalid", failedAttempts, locked: Boolean(lockedUntil) } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reset code invalid or expired." });
      }
      const newPasswordHash = await hashStudentSecret(input.newPassword);
      await db.update(studentCredentials).set({ passwordHash: newPasswordHash, passwordMode: "custom", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }).where(eq(studentCredentials.studentId, student.id));
      await writeAuditLog({ schoolId: student.schoolId, actorUserId: student.userId, action: "student.password_reset_completed", entityType: "student", entityId: student.id, metadata: { username, sessionIssued: false, codeConsumed: true } });
      return { success: true } as const;
    }),
    changeStudentPassword: protectedProcedure.input(z.object({ currentPassword: studentCurrentPasswordSchema, newPassword: studentNewPasswordSchema, confirmPassword: studentNewPasswordSchema })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "student") throw new TRPCError({ code: "FORBIDDEN", message: "Only learner accounts can change a learner password." });
      if (input.currentPassword === input.newPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Your new password must be different from the current password." });
      if (input.newPassword !== input.confirmPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
      const [student] = await db.select().from(students).where(and(eq(students.userId, ctx.user.id), eq(students.schoolId, ctx.user.schoolId!))).limit(1);
      if (!student || student.status === "inactive" || student.status === "transferred") throw new TRPCError({ code: "FORBIDDEN", message: "Your learner account is not active." });
      const [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      if (!credential?.passwordHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Your learner password is not ready. Sign out and sign in again with your admission number first." });
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Try again in 15 minutes." });
      const currentPasswordValid = await verifyStudentSecret(input.currentPassword, credential.passwordHash) || (credential.passwordMode === "admission_number" && await verifyStudentSecret(normalizeStudentIdentifier(input.currentPassword), credential.passwordHash));
      if (!currentPasswordValid) {
        const failedAttempts = Number(credential.failedAttempts ?? 0) + 1;
        const lockedUntil = failedAttempts >= STUDENT_LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + STUDENT_LOGIN_LOCK_MS) : null;
        await db.update(studentCredentials).set({ failedAttempts, lockedUntil }).where(eq(studentCredentials.studentId, student.id));
        await writeAuditLog({ schoolId: student.schoolId, actorUserId: ctx.user.id, action: "student.password_change_failed", entityType: "student", entityId: student.id, metadata: { reason: "current_password_invalid", failedAttempts, locked: Boolean(lockedUntil) } });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      if (await verifyStudentSecret(input.newPassword, credential.passwordHash) || (credential.passwordMode === "admission_number" && await verifyStudentSecret(normalizeStudentIdentifier(input.newPassword), credential.passwordHash))) throw new TRPCError({ code: "BAD_REQUEST", message: "Your new password must be different from the current password." });
      const newPasswordHash = await hashStudentSecret(input.newPassword);
      await db.update(studentCredentials).set({ passwordHash: newPasswordHash, passwordMode: "custom", activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null }).where(eq(studentCredentials.studentId, student.id));
      await writeAuditLog({ schoolId: student.schoolId, actorUserId: ctx.user.id, action: "student.password_changed", entityType: "student", entityId: student.id, metadata: { passwordMode: "custom", sessionPreserved: true } });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  school: schoolRouter,

});

export type AppRouter = typeof appRouter;
