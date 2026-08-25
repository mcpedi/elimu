import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { schools, studentCredentials, students, users } from "../drizzle/schema";
import { createStudentActivationCode, hashStudentSecret, normalizeStudentIdentifier, STUDENT_ACTIVATION_TTL_MS, STUDENT_LOGIN_LOCK_MS, STUDENT_LOGIN_MAX_ATTEMPTS, verifyStudentSecret } from "./student-auth";
import { getDb, writeAuditLog } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { sdk } from "./_core/sdk";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { schoolRouter } from "./routers/school";
import { requireRole } from "./permissions";

const studentPasswordSchema = z.string().min(8, "Use at least 8 characters.").max(128, "Password is too long.");
const studentAdmissionSchema = z.string().trim().min(1, "Enter your admission number.").max(40);
const studentActivationSchema = z.string().trim().min(8, "Enter the activation code from the school office.").max(32);
const STUDENT_LOGIN_ERROR = "Invalid admission number or password.";

async function getStudentAuthRecord(admissionNo: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  const [school] = await db.select().from(schools).orderBy(asc(schools.id)).limit(1);
  if (!school) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The school profile is not ready for learner sign-in." });
  const normalized = normalizeStudentIdentifier(admissionNo);
  const [student] = await db.select().from(students).where(and(eq(students.admissionNo, normalized), eq(students.schoolId, school.id))).limit(1);
  return { db, school, student };
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
      await db.insert(users).values({ openId, name: `${student.firstName} ${student.lastName}`, email: student.email, loginMethod: "student_password", role: "student" });
      user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
    }
    if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create the learner login account." });
    if (student.userId !== user.id) await db.update(students).set({ userId: user.id }).where(eq(students.id, student.id));
  }
  return user;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    issueStudentActivationCode: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
      const [school] = await db.select().from(schools).orderBy(asc(schools.id)).limit(1);
      const [student] = school ? await db.select().from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1) : [];
      if (!school || !student) throw new TRPCError({ code: "NOT_FOUND", message: "Learner not found in this school." });
      const activationCode = createStudentActivationCode();
      const values = { studentId: student.id, passwordHash: null, activationCodeHash: await hashStudentSecret(activationCode), activationCodeExpiresAt: new Date(Date.now() + STUDENT_ACTIVATION_TTL_MS), failedAttempts: 0, lockedUntil: null };
      const [existing] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      if (existing) await db.update(studentCredentials).set(values).where(eq(studentCredentials.studentId, student.id));
      else await db.insert(studentCredentials).values(values);
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.activation_code_issued", entityType: "student", entityId: student.id, metadata: { admissionNo: student.admissionNo, expiresAt: values.activationCodeExpiresAt.toISOString(), resetsExistingPassword: Boolean(existing?.passwordHash) } });
      return { success: true, activationCode, expiresAt: values.activationCodeExpiresAt };
    }),
    activateStudentPassword: publicProcedure.input(z.object({ admissionNo: studentAdmissionSchema, activationCode: studentActivationSchema, password: studentPasswordSchema, confirmPassword: studentPasswordSchema })).mutation(async ({ ctx, input }) => {
      if (input.password !== input.confirmPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match." });
      const { db, school, student } = await getStudentAuthRecord(input.admissionNo);
      if (!student || student.status === "inactive" || student.status === "transferred") throw new TRPCError({ code: "BAD_REQUEST", message: "Activation code invalid or expired." });
      const [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      const codeExpired = !credential?.activationCodeExpiresAt || credential.activationCodeExpiresAt.getTime() < Date.now();
      const validCode = !codeExpired && await verifyStudentSecret(input.activationCode, credential?.activationCodeHash);
      if (!validCode) throw new TRPCError({ code: "BAD_REQUEST", message: "Activation code invalid or expired." });
      const user = await ensureStudentUser(db, student);
      await db.update(studentCredentials).set({ passwordHash: await hashStudentSecret(input.password), activationCodeHash: null, activationCodeExpiresAt: null, failedAttempts: 0, lockedUntil: null, lastLoginAt: null }).where(eq(studentCredentials.studentId, student.id));
      await writeAuditLog({ schoolId: school.id, actorUserId: user.id, action: "student.password_activated", entityType: "student", entityId: student.id, metadata: { admissionNo: student.admissionNo } });
      return { success: true } as const;
    }),
    loginStudent: publicProcedure.input(z.object({ admissionNo: studentAdmissionSchema, password: studentPasswordSchema })).mutation(async ({ ctx, input }) => {
      const { db, school, student } = await getStudentAuthRecord(input.admissionNo);
      if (!student || student.status === "inactive" || student.status === "transferred") throw new TRPCError({ code: "UNAUTHORIZED", message: STUDENT_LOGIN_ERROR });
      const [credential] = await db.select().from(studentCredentials).where(eq(studentCredentials.studentId, student.id)).limit(1);
      if (!credential?.passwordHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Password not set. Use the activation code from the school office first." });
      if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Try again in 15 minutes." });
      const validPassword = await verifyStudentSecret(input.password, credential.passwordHash);
      if (!validPassword) {
        const failedAttempts = Number(credential.failedAttempts ?? 0) + 1;
        const lockedUntil = failedAttempts >= STUDENT_LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + STUDENT_LOGIN_LOCK_MS) : null;
        await db.update(studentCredentials).set({ failedAttempts, lockedUntil }).where(eq(studentCredentials.studentId, student.id));
        await writeAuditLog({ schoolId: school.id, actorUserId: student.userId, action: "student.login_failed", entityType: "student", entityId: student.id, metadata: { admissionNo: student.admissionNo, failedAttempts, locked: Boolean(lockedUntil) } });
        throw new TRPCError({ code: "UNAUTHORIZED", message: STUDENT_LOGIN_ERROR });
      }
      const user = await ensureStudentUser(db, student);
      const signedInAt = new Date();
      await db.update(studentCredentials).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: signedInAt }).where(eq(studentCredentials.studentId, student.id));
      await db.update(users).set({ lastSignedIn: signedInAt, name: `${student.firstName} ${student.lastName}`, role: "student", loginMethod: "student_password" }).where(eq(users.id, user.id));
      const sessionToken = await sdk.createSessionToken(user.openId, { name: `${student.firstName} ${student.lastName}`, expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      await writeAuditLog({ schoolId: school.id, actorUserId: user.id, action: "student.login_succeeded", entityType: "student", entityId: student.id, metadata: { admissionNo: student.admissionNo } });
      return { success: true, student: { id: student.id, admissionNo: student.admissionNo, name: `${student.firstName} ${student.lastName}` } } as const;
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
