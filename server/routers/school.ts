import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  academicYears,
  announcements,
  assessments,
  assignments,
  attendanceRecords,
  auditLogs,
  departments,
  feeStructures,
  guardians,
  marks,
  notifications,
  payments,
  reportCards,
  reportExports,
  receipts,
  schoolClasses,
  schools,
  studentDocuments,
  studentFeeAccounts,
  studentGuardians,
  students,
  studentSubjects,
  subjects,
  teacherAssignments,
  teacherAttendance,
  teachers,
  terms,
  timetableSlots,
  users,
} from "../../drizzle/schema";
import { buildTermPerformanceTrend, calculateGrade, DEFAULT_KENYAN_GRADING_SCALE, summarizeMarks, summarizePerformanceEntries } from "../academics";
import { summarizeAttendance } from "../attendance";
import { getDb, writeAuditLog } from "../db";
import { adjustFeeDue, applyPayment } from "../fee-calculations";
import { assertEligibleClassTeacher, assertRecordRemovable, validateClassCapacity, validateNamedRecordUpdate } from "../management-rules";
import { academicRoles, administrativeRoles, financeRoles, requireRole } from "../permissions";
import { storagePut } from "../storage";
import { hasTimetableConflict } from "../timetable";
import { protectedProcedure, router } from "../_core/trpc";
import { getTenantContext } from "../_core/tenant";
import { ENV } from "../_core/env";
import { mvpRouter } from "./mvp";

const schoolRoleSchema = z.enum([
  "user",
  "super_admin",
  "principal",
  "deputy_principal",
  "teacher",
  "class_teacher",
  "bursar",
  "parent",
  "student",
]);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.");

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayStamp() {
  return toDate(new Date().toISOString().slice(0, 10));
}

function receiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RCPT-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function getOperatingSchool() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  const tenant = getTenantContext();
  if (!tenant?.schoolId) throw new TRPCError({ code: "FORBIDDEN", message: "Your account is not assigned to a school." });
  const schoolRows = await db.select().from(schools).where(eq(schools.id, tenant.schoolId)).limit(1);
  const school = schoolRows.find(row => row.id === tenant.schoolId);
  if (!school) throw new TRPCError({ code: "FORBIDDEN", message: "Your school access is unavailable. Contact your school administrator." });
  return { db, school };
}

async function assertAndBindUserToSchool(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, schoolId: number) {
  const [account] = await db.select({ id: users.id, role: users.role, schoolId: users.schoolId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
  if (account.schoolId && account.schoolId !== schoolId) throw new TRPCError({ code: "FORBIDDEN", message: "This account belongs to a different school." });
  if (!account.schoolId) await db.update(users).set({ schoolId }).where(eq(users.id, userId));
  return account;
}

async function platformMonitorAccess(user: typeof users.$inferSelect) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  if (user.role !== "super_admin") return { db, allowed: false };
  const isOwnerBootstrap = Boolean(ENV.ownerOpenId) && user.openId === ENV.ownerOpenId;
  if (!user.isPlatformAdmin && !isOwnerBootstrap) return { db, allowed: false };
  if (isOwnerBootstrap && !user.isPlatformAdmin) await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, user.id));
  return { db, allowed: true };
}

async function getLinkedStudentIds(userId: number, role: string) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  const tenant = getTenantContext();
  if (!tenant?.schoolId) return [];
  if (role === "student") {
    const rows = await db.select({ id: students.id }).from(students).where(and(eq(students.userId, userId), eq(students.schoolId, tenant.schoolId)));
    return rows.map(row => row.id);
  }
  if (role === "parent") {
    const rows = await db
      .select({ id: studentGuardians.studentId })
      .from(guardians)
      .innerJoin(studentGuardians, eq(studentGuardians.guardianId, guardians.id))
      .where(and(eq(guardians.userId, userId), eq(guardians.schoolId, tenant.schoolId)));
    return rows.map(row => row.id);
  }
  return [];
}

async function getTeacherForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database service is unavailable." });
  const tenant = getTenantContext();
  if (!tenant?.schoolId) return undefined;
  const [teacher] = await db.select().from(teachers).where(and(eq(teachers.userId, userId), eq(teachers.schoolId, tenant.schoolId))).limit(1);
  return teacher;
}

async function assertTeacherAssignment(userId: number, role: string, classId: number, subjectId?: number) {
  if (administrativeRoles.includes(role as (typeof administrativeRoles)[number])) return;
  if (role !== "teacher" && role !== "class_teacher") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only assigned teaching staff may complete this academic action." });
  }
  const teacher = await getTeacherForUser(userId);
  if (!teacher) throw new TRPCError({ code: "FORBIDDEN", message: "Your login is not linked to a teacher profile." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  if (role === "class_teacher") {
    const [classRecord] = await db.select({ id: schoolClasses.id }).from(schoolClasses).where(and(eq(schoolClasses.id, classId), eq(schoolClasses.classTeacherId, teacher.id))).limit(1);
    if (classRecord) return;
  }
  const conditions = [eq(teacherAssignments.teacherId, teacher.id), eq(teacherAssignments.classId, classId)];
  if (subjectId) conditions.push(eq(teacherAssignments.subjectId, subjectId));
  const [assignment] = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(...conditions)).limit(1);
  if (!assignment) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this class and subject." });
}

async function assertStudentVisibility(userId: number, role: string, studentId: number) {
  if (administrativeRoles.includes(role as (typeof administrativeRoles)[number]) || role === "bursar") return;
  const allowed = await getLinkedStudentIds(userId, role);
  if (!allowed.includes(studentId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You may only access records linked to your account." });
  }
}

async function announcementFeedForUser(userId: number, role: string) {
  const { db, school } = await getOperatingSchool();
  const all = await db.select().from(announcements).where(eq(announcements.schoolId, school.id)).orderBy(desc(announcements.publishedAt)).limit(100);
  if (administrativeRoles.includes(role as (typeof administrativeRoles)[number])) return all;
  if (role === "teacher" || role === "class_teacher") return all.filter(item => item.targetScope === "school" || item.targetScope === "teachers");
  const studentIds = await getLinkedStudentIds(userId, role);
  if (studentIds.length === 0) return [];
  const learnerRows = await db
    .select({ classId: students.currentClassId, form: schoolClasses.form })
    .from(students)
    .leftJoin(schoolClasses, eq(students.currentClassId, schoolClasses.id))
    .where(inArray(students.id, studentIds));
  const classIds = learnerRows.map(row => row.classId).filter((id): id is number => id !== null);
  const forms = learnerRows.map(row => row.form).filter((form): form is NonNullable<typeof form> => form !== null);
  return all.filter(item => {
    if (item.targetScope === "school") return true;
    if (role === "parent" && item.targetScope === "parents") return true;
    if (role === "student" && item.targetScope === "students") return true;
    if (item.targetScope === "class" && item.targetClassId && classIds.includes(item.targetClassId)) return true;
    return item.targetScope === "form" && item.targetForm !== null && forms.includes(item.targetForm);
  });
}

export const schoolRouter = router({
  mvp: mvpRouter,
  setup: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const schoolRows = ctx.user.schoolId ? await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, ctx.user.schoolId)).limit(1) : [];
      const school = schoolRows.find(row => row.id === ctx.user.schoolId);
      return { exists: Boolean(school), school };
    }),
    createSchool: protectedProcedure
      .input(z.object({ name: z.string().min(3).max(180), code: z.string().min(2).max(24).transform(value => value.toUpperCase()), phone: z.string().max(20).optional(), email: z.string().email().optional(), county: z.string().max(80).optional() }))
      .mutation(async ({ ctx, input }) => {
        requireRole(ctx.user, ["super_admin"]);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (ctx.user.schoolId) throw new TRPCError({ code: "CONFLICT", message: "Your account is already assigned to a school." });
        await db.insert(schools).values({ ...input, gradeScale: DEFAULT_KENYAN_GRADING_SCALE });
        const [school] = await db.select().from(schools).where(eq(schools.code, input.code)).limit(1);
        if (!school) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "School creation could not be completed." });
        await db.update(users).set({ schoolId: school.id }).where(eq(users.id, ctx.user.id));
        await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school?.id, action: "school.created", entityType: "school", entityId: school?.id, metadata: { code: input.code } });
        return school;
      }),
      updateSchool: protectedProcedure
      .input(z.object({ name: z.string().min(3).max(180).optional(), phone: z.string().max(20).nullable().optional(), email: z.string().email().nullable().optional(), county: z.string().max(80).nullable().optional(), admissionPrefix: z.string().min(1).max(16).optional(), gradeScale: z.array(z.object({ min: z.number(), max: z.number(), grade: z.string().min(0).max(4), points: z.number().int().min(0).max(20), remark: z.string().max(120).optional() })).optional() }))
      .mutation(async ({ ctx, input }) => {
        requireRole(ctx.user, ["super_admin", "principal"]);
        const { db, school } = await getOperatingSchool();
        await db.update(schools).set(input).where(eq(schools.id, school.id));
        await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school.id, action: "school.updated", entityType: "school", entityId: school.id });
        return { success: true };
      }),
      uploadLogo: protectedProcedure.input(z.object({ fileName: z.string().min(1).max(120), mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().min(32).max(4_000_000) })).mutation(async ({ ctx, input }) => {
        requireRole(ctx.user, ["super_admin", "principal"]);
        const { db, school } = await getOperatingSchool();
        const bytes = Buffer.from(input.data, "base64");
        if (!bytes.length || bytes.length > 2_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Logo must be a valid image no larger than 2 MB." });
        const signatures: Record<string, (data: Buffer) => boolean> = {
          "image/png": data => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          "image/jpeg": data => data.subarray(0, 2).equals(Buffer.from([255, 216])),
          "image/webp": data => data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP",
        };
        if (!signatures[input.mimeType](bytes)) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file does not match its image type." });
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "school-logo";
        const { key, url } = await storagePut(`schools/${school.id}/branding/${safeName}`, bytes, input.mimeType);
        await db.update(schools).set({ logoKey: key }).where(eq(schools.id, school.id));
        await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school.id, action: "school.logo_uploaded", entityType: "school", entityId: school.id, metadata: { mimeType: input.mimeType, fileName: safeName, size: bytes.length } });
        return { success: true, logoKey: key, logoUrl: url };
      }),
  }),

  access: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["super_admin"]);
      const { db, school } = await getOperatingSchool();
      return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.schoolId, school.id)).orderBy(desc(users.lastSignedIn)).limit(200);
    }),
    assignRole: protectedProcedure.input(z.object({ userId: z.number().int().positive(), role: schoolRoleSchema.exclude(["user"]) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin"]);
      const { db, school } = await getOperatingSchool();
      const account = await assertAndBindUserToSchool(db, input.userId, school.id);
      if (account.schoolId && account.schoolId !== school.id) throw new TRPCError({ code: "FORBIDDEN", message: "This account belongs to a different school." });
      await db.update(users).set({ role: input.role }).where(and(eq(users.id, input.userId), eq(users.schoolId, school.id)));
      await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school.id, action: "user.role_assigned", entityType: "user", entityId: input.userId, metadata: { role: input.role } });
      return { success: true };
    }),
  }),

  platform: router({
    access: protectedProcedure.query(async ({ ctx }) => {
      const { allowed } = await platformMonitorAccess(ctx.user);
      return { allowed };
    }),
    administrators: protectedProcedure.query(async ({ ctx }) => {
      const { db, allowed } = await platformMonitorAccess(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator management is restricted to designated platform administrators." });
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, schoolId: users.schoolId, isPlatformAdmin: users.isPlatformAdmin, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.role, "super_admin"))
        .orderBy(asc(users.name), asc(users.email))
        .limit(200);
      const accounts = rows
        .filter(row => row.role === "super_admin")
        .map(row => ({ id: row.id, name: row.name, email: row.email, role: row.role, hasSchoolAssignment: Boolean(row.schoolId), isPlatformAdmin: row.isPlatformAdmin, lastSignedIn: row.lastSignedIn, createdAt: row.createdAt }));
      const administrators = accounts.filter(row => row.isPlatformAdmin);
      const eligibleAccounts = accounts.filter(row => !row.isPlatformAdmin);
      await writeAuditLog({ actorUserId: ctx.user.id, action: "platform.admin_management_viewed", entityType: "platform", metadata: { administratorCount: administrators.length, eligibleCount: eligibleAccounts.length } });
      return { administrators, eligibleAccounts };
    }),
    designateAdministrator: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, allowed } = await platformMonitorAccess(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator management is restricted to designated platform administrators." });
      const rows = await db.select({ id: users.id, role: users.role, isPlatformAdmin: users.isPlatformAdmin }).from(users).where(eq(users.id, input.userId)).limit(1);
      const account = rows.find(row => row.id === input.userId);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
      if (account.role !== "super_admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only Super Administrator accounts can be designated as platform administrators." });
      if (account.isPlatformAdmin) return { success: true, changed: false };
      await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, account.id));
      await writeAuditLog({ actorUserId: ctx.user.id, action: "platform.administrator_designated", entityType: "user", entityId: account.id, metadata: { targetRole: account.role } });
      return { success: true, changed: true };
    }),
    revokeAdministrator: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, allowed } = await platformMonitorAccess(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator management is restricted to designated platform administrators." });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot revoke your own platform administrator access." });
      const rows = await db.select({ id: users.id, openId: users.openId, role: users.role, isPlatformAdmin: users.isPlatformAdmin }).from(users).where(eq(users.id, input.userId)).limit(1);
      const account = rows.find(row => row.id === input.userId);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
      if (ENV.ownerOpenId && account.openId === ENV.ownerOpenId) throw new TRPCError({ code: "FORBIDDEN", message: "The platform owner designation cannot be revoked." });
      if (account.role !== "super_admin" || !account.isPlatformAdmin) throw new TRPCError({ code: "BAD_REQUEST", message: "This account is not a current platform administrator." });
      await db.update(users).set({ isPlatformAdmin: false }).where(eq(users.id, account.id));
      await writeAuditLog({ actorUserId: ctx.user.id, action: "platform.administrator_revoked", entityType: "user", entityId: account.id, metadata: { targetRole: account.role } });
      return { success: true };
    }),
    registerSchool: protectedProcedure
      .input(z.object({ name: z.string().min(3).max(180), code: z.string().min(2).max(24).transform(value => value.trim().toUpperCase()), phone: z.string().max(20).optional(), email: z.string().email().optional(), county: z.string().max(80).optional() }))
      .mutation(async ({ ctx, input }) => {
        const { db, allowed } = await platformMonitorAccess(ctx.user);
        if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "School registration is restricted to designated platform administrators." });
        const existingRows = await db.select({ id: schools.id, code: schools.code }).from(schools).where(eq(schools.code, input.code)).limit(1);
        if (existingRows.some(school => school.code === input.code)) throw new TRPCError({ code: "CONFLICT", message: "A school with this code is already registered." });
        await db.insert(schools).values({ ...input, gradeScale: DEFAULT_KENYAN_GRADING_SCALE });
        const createdRows = await db.select({ id: schools.id, name: schools.name, code: schools.code, county: schools.county, createdAt: schools.createdAt }).from(schools).where(eq(schools.code, input.code)).limit(1);
        const school = createdRows.find(row => row.code === input.code);
        if (!school) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "School registration could not be completed." });
        await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school.id, action: "platform.school_registered", entityType: "school", entityId: school.id, metadata: { code: school.code } });
        return school;
      }),
    assignUnassignedAccount: protectedProcedure
      .input(z.object({ schoolId: z.number().int().positive(), userId: z.number().int().positive(), role: schoolRoleSchema.exclude(["user"]) }))
      .mutation(async ({ ctx, input }) => {
        const { db, allowed } = await platformMonitorAccess(ctx.user);
        if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "School account assignment is restricted to designated platform administrators." });
        const schoolRows = await db.select({ id: schools.id, name: schools.name, code: schools.code }).from(schools).where(eq(schools.id, input.schoolId)).limit(1);
        const school = schoolRows.find(row => row.id === input.schoolId);
        if (!school) throw new TRPCError({ code: "NOT_FOUND", message: "Target school was not found." });
        const accountRows = await db.select({ id: users.id, schoolId: users.schoolId, role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
        const account = accountRows.find(row => row.id === input.userId);
        if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
        if (account.schoolId) throw new TRPCError({ code: "FORBIDDEN", message: "This account is already assigned to a school and cannot be reassigned here." });
        await db.update(users).set({ schoolId: school.id, role: input.role }).where(and(eq(users.id, account.id), isNull(users.schoolId)));
        await writeAuditLog({ actorUserId: ctx.user.id, schoolId: school.id, action: "platform.unassigned_account_assigned", entityType: "user", entityId: account.id, metadata: { role: input.role, schoolCode: school.code } });
        return { success: true };
      }),
    overview: protectedProcedure.query(async ({ ctx }) => {
      const { db, allowed } = await platformMonitorAccess(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Platform monitoring is restricted to designated platform administrators." });
      const schoolRows = await db
        .select({
          id: schools.id,
          name: schools.name,
          code: schools.code,
          county: schools.county,
          createdAt: schools.createdAt,
          registeredUsers: sql<number>`count(${users.id})`,
          activeUsers: sql<number>`sum(case when ${users.lastSignedIn} >= date_sub(utc_timestamp(), interval 30 day) then 1 else 0 end)`,
        })
        .from(schools)
        .leftJoin(users, eq(users.schoolId, schools.id))
        .groupBy(schools.id, schools.name, schools.code, schools.county, schools.createdAt)
        .orderBy(desc(schools.createdAt));
      const unassignedAccounts = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt })
        .from(users)
        .where(isNull(users.schoolId))
        .orderBy(desc(users.lastSignedIn))
        .limit(100);
      const monitoredSchools = schoolRows.map(row => ({ ...row, registeredUsers: Number(row.registeredUsers ?? 0), activeUsers: Number(row.activeUsers ?? 0) }));
      await writeAuditLog({ actorUserId: ctx.user.id, action: "platform.monitor_viewed", entityType: "platform", metadata: { schoolCount: monitoredSchools.length, unassignedCount: unassignedAccounts.length } });
      return {
        totals: {
          schools: monitoredSchools.length,
          registeredUsers: monitoredSchools.reduce((sum, row) => sum + row.registeredUsers, 0) + unassignedAccounts.length,
          activeUsers: monitoredSchools.reduce((sum, row) => sum + row.activeUsers, 0),
          unassignedAccounts: unassignedAccounts.length,
        },
        schools: monitoredSchools,
        unassignedAccounts,
      };
    }),
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ["super_admin", "principal", "deputy_principal", "bursar", "teacher", "class_teacher", "parent", "student"]);
    const { db, school } = await getOperatingSchool();
    const today = dayStamp();
    if (ctx.user.role === "parent" || ctx.user.role === "student") {
      const studentIds = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      const [attendanceRows, feeRows, resultRows] = await Promise.all([
        studentIds.length ? db.select({ status: attendanceRecords.status, date: attendanceRecords.attendanceDate }).from(attendanceRecords).where(inArray(attendanceRecords.studentId, studentIds)).orderBy(desc(attendanceRecords.attendanceDate)).limit(7) : [],
        studentIds.length ? db.select({ amountDue: studentFeeAccounts.amountDue, amountPaid: studentFeeAccounts.amountPaid, studentId: studentFeeAccounts.studentId }).from(studentFeeAccounts).where(inArray(studentFeeAccounts.studentId, studentIds)) : [],
        studentIds.length ? db.select({ score: marks.score, grade: marks.grade, studentId: marks.studentId }).from(marks).where(inArray(marks.studentId, studentIds)).orderBy(desc(marks.enteredAt)).limit(10) : [],
      ]);
      const balance = feeRows.reduce((sum, row) => sum + Number(row.amountDue) - Number(row.amountPaid), 0);
      return { kind: "portal" as const, linkedStudentCount: studentIds.length, feeBalance: balance, recentAttendance: attendanceRows, recentResults: resultRows, announcements: await announcementFeedForUser(ctx.user.id, ctx.user.role) };
    }

    const [studentCount, teacherCount, classCount, attendanceCount, paymentSum, outstandingRows, recentPaymentRows, recentMarkRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(students).where(and(eq(students.schoolId, school.id), eq(students.status, "active"))),
      db.select({ count: sql<number>`count(*)` }).from(teachers).where(and(eq(teachers.schoolId, school.id), eq(teachers.employmentStatus, "active"))),
      db.select({ count: sql<number>`count(*)` }).from(schoolClasses).where(and(eq(schoolClasses.schoolId, school.id), eq(schoolClasses.isActive, true))),
      db.select({ count: sql<number>`count(*)` }).from(attendanceRecords).where(eq(attendanceRecords.attendanceDate, today)),
      db.select({ amount: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(eq(students.schoolId, school.id)),
      db.select({ due: studentFeeAccounts.amountDue, paid: studentFeeAccounts.amountPaid }).from(studentFeeAccounts).innerJoin(students, eq(studentFeeAccounts.studentId, students.id)).where(eq(students.schoolId, school.id)),
      db.select({ id: payments.id, amount: payments.amount, method: payments.method, receiptNo: payments.receiptNo, paymentDate: payments.paymentDate, firstName: students.firstName, lastName: students.lastName }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(eq(students.schoolId, school.id)).orderBy(desc(payments.createdAt)).limit(6),
      db.select({ id: marks.id, grade: marks.grade, score: marks.score, assessment: assessments.title, firstName: students.firstName, lastName: students.lastName }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(students, eq(marks.studentId, students.id)).where(eq(students.schoolId, school.id)).orderBy(desc(marks.enteredAt)).limit(6),
    ]);
    const outstanding = outstandingRows.reduce((sum, row) => sum + Math.max(0, Number(row.due) - Number(row.paid)), 0);
    return {
      kind: "staff" as const,
      school,
      kpis: { students: Number(studentCount[0]?.count ?? 0), teachers: Number(teacherCount[0]?.count ?? 0), activeClasses: Number(classCount[0]?.count ?? 0), todayAttendance: Number(attendanceCount[0]?.count ?? 0), feeCollection: Number(paymentSum[0]?.amount ?? 0), outstandingFees: outstanding },
      recentPayments: recentPaymentRows,
      recentAcademicActivity: recentMarkRows,
      announcements: await announcementFeedForUser(ctx.user.id, ctx.user.role),
    };
  }),

  students: router({
    list: protectedProcedure.input(z.object({ query: z.string().max(80).optional(), classId: z.number().int().positive().optional(), status: z.enum(["active", "transferred", "completed", "inactive"]).optional() }).optional()).query(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher", "bursar"]);
      const { db, school } = await getOperatingSchool();
      const filters = [eq(students.schoolId, school.id)];
      if (ctx.user.role === "teacher" || ctx.user.role === "class_teacher") {
        const teacher = await getTeacherForUser(ctx.user.id);
        if (!teacher) return [];
        const assignedClasses = await db.select({ classId: teacherAssignments.classId }).from(teacherAssignments).where(eq(teacherAssignments.teacherId, teacher.id));
        const leadClasses = await db.select({ id: schoolClasses.id }).from(schoolClasses).where(eq(schoolClasses.classTeacherId, teacher.id));
        const scopedClassIds = Array.from(new Set([...assignedClasses.map(row => row.classId), ...leadClasses.map(row => row.id)]));
        if (!scopedClassIds.length) return [];
        filters.push(inArray(students.currentClassId, scopedClassIds));
      }
      if (input?.classId) filters.push(eq(students.currentClassId, input.classId));
      if (input?.status) filters.push(eq(students.status, input.status));
      const base = and(...filters);
      const matcher = input?.query?.trim();
      return db
        .select({ id: students.id, admissionNo: students.admissionNo, firstName: students.firstName, middleName: students.middleName, lastName: students.lastName, status: students.status, form: schoolClasses.form, stream: schoolClasses.stream, classId: students.currentClassId })
        .from(students)
        .leftJoin(schoolClasses, eq(students.currentClassId, schoolClasses.id))
        .where(matcher ? and(base, or(like(students.firstName, `%${matcher}%`), like(students.lastName, `%${matcher}%`), like(students.admissionNo, `%${matcher}%`))) : base)
        .orderBy(asc(students.lastName), asc(students.firstName))
        .limit(200);
    }),
    create: protectedProcedure.input(z.object({ firstName: z.string().min(1).max(80), middleName: z.string().max(80).optional(), lastName: z.string().min(1).max(80), gender: z.enum(["female", "male", "other", "undisclosed"]).default("undisclosed"), dateOfBirth: dateSchema.optional(), phone: z.string().max(20).optional(), email: z.string().email().optional(), classId: z.number().int().positive().optional(), enrolledOn: dateSchema, guardian: z.object({ firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), relationship: z.string().min(1).max(40), phone: z.string().min(7).max(20), email: z.string().email().optional() }).optional(), subjectIds: z.array(z.number().int().positive()).max(20).optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const count = await db.select({ count: sql<number>`count(*)` }).from(students).where(eq(students.schoolId, school.id));
      const admissionNo = `${school.admissionPrefix}-${String(Number(count[0]?.count ?? 0) + 1).padStart(4, "0")}`;
      await db.insert(students).values({ schoolId: school.id, admissionNo, firstName: input.firstName, middleName: input.middleName, lastName: input.lastName, gender: input.gender, dateOfBirth: input.dateOfBirth ? toDate(input.dateOfBirth) : undefined, phone: input.phone, email: input.email, currentClassId: input.classId, enrolledOn: toDate(input.enrolledOn) });
      const [student] = await db.select().from(students).where(eq(students.admissionNo, admissionNo)).limit(1);
      if (!student) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.guardian) {
        await db.insert(guardians).values({ schoolId: school.id, ...input.guardian });
        const [guardian] = await db.select().from(guardians).where(and(eq(guardians.schoolId, school.id), eq(guardians.phone, input.guardian.phone))).orderBy(desc(guardians.id)).limit(1);
        if (guardian) await db.insert(studentGuardians).values({ studentId: student.id, guardianId: guardian.id, isPrimary: true });
      }
      if (input.subjectIds?.length) await db.insert(studentSubjects).values(input.subjectIds.map(subjectId => ({ studentId: student.id, subjectId })));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.created", entityType: "student", entityId: student.id, metadata: { admissionNo } });
      return student;
    }),
    get: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertStudentVisibility(ctx.user.id, ctx.user.role, input.studentId);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id, schoolId: students.schoolId, admissionNo: students.admissionNo, firstName: students.firstName, middleName: students.middleName, lastName: students.lastName, gender: students.gender, dateOfBirth: students.dateOfBirth, phone: students.phone, email: students.email, status: students.status, enrolledOn: students.enrolledOn, form: schoolClasses.form, stream: schoolClasses.stream, classId: schoolClasses.id }).from(students).leftJoin(schoolClasses, eq(students.currentClassId, schoolClasses.id)).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student || student.schoolId !== school.id) throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      const [guardianRows, documentRows, subjectRows, attendanceRows, feeRows, markRows] = await Promise.all([
        db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName, relationship: guardians.relationship, phone: guardians.phone, email: guardians.email, isPrimary: studentGuardians.isPrimary }).from(studentGuardians).innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id)).where(eq(studentGuardians.studentId, input.studentId)),
        db.select().from(studentDocuments).where(eq(studentDocuments.studentId, input.studentId)).orderBy(desc(studentDocuments.createdAt)),
        db.select({ id: subjects.id, code: subjects.code, name: subjects.name }).from(studentSubjects).innerJoin(subjects, eq(studentSubjects.subjectId, subjects.id)).where(eq(studentSubjects.studentId, input.studentId)),
        db.select({ status: attendanceRecords.status, attendanceDate: attendanceRecords.attendanceDate, absenceReason: attendanceRecords.absenceReason }).from(attendanceRecords).where(eq(attendanceRecords.studentId, input.studentId)).orderBy(desc(attendanceRecords.attendanceDate)).limit(31),
        db.select({ id: studentFeeAccounts.id, amountDue: studentFeeAccounts.amountDue, amountPaid: studentFeeAccounts.amountPaid, status: studentFeeAccounts.status, name: feeStructures.name, termId: feeStructures.termId }).from(studentFeeAccounts).innerJoin(feeStructures, eq(studentFeeAccounts.feeStructureId, feeStructures.id)).where(eq(studentFeeAccounts.studentId, input.studentId)),
        db.select({ score: marks.score, grade: marks.grade, gradePoints: marks.gradePoints, subject: subjects.name, assessment: assessments.title, assessmentDate: assessments.assessmentDate }).from(marks).innerJoin(subjects, eq(marks.subjectId, subjects.id)).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).where(eq(marks.studentId, input.studentId)).orderBy(desc(marks.enteredAt)).limit(50),
      ]);
      return { student, guardians: guardianRows, documents: documentRows, subjects: subjectRows, attendance: attendanceRows, feeAccounts: feeRows, marks: markRows };
    }),
    results: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["parent", "student"]);
      const { db, school } = await getOperatingSchool();
      const studentIds = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      if (studentIds.length === 0) return [];
      return db.select({ studentId: students.id, admissionNo: students.admissionNo, firstName: students.firstName, lastName: students.lastName, subject: subjects.name, subjectCode: subjects.code, assessment: assessments.title, assessmentDate: assessments.assessmentDate, score: marks.score, grade: marks.grade, gradePoints: marks.gradePoints }).from(marks).innerJoin(students, eq(marks.studentId, students.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).where(and(eq(students.schoolId, school.id), inArray(marks.studentId, studentIds))).orderBy(desc(assessments.assessmentDate), asc(subjects.name)).limit(100);
    }),
    linkStudentAccount: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal"]);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      const account = await assertAndBindUserToSchool(db, input.userId, school.id);
      if (!student || !account) throw new TRPCError({ code: "NOT_FOUND", message: "Student or user account not found." });
      if (account.role !== "student") throw new TRPCError({ code: "BAD_REQUEST", message: "Assign the Student role before linking this account." });
      await db.update(students).set({ userId: input.userId }).where(eq(students.id, input.studentId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.account_linked", entityType: "student", entityId: input.studentId, metadata: { userId: input.userId } });
      return { success: true };
    }),
    linkGuardianAccount: protectedProcedure.input(z.object({ guardianId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal"]);
      const { db, school } = await getOperatingSchool();
      const [guardian] = await db.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.id, input.guardianId), eq(guardians.schoolId, school.id))).limit(1);
      const account = await assertAndBindUserToSchool(db, input.userId, school.id);
      if (!guardian || !account) throw new TRPCError({ code: "NOT_FOUND", message: "Guardian or user account not found." });
      if (account.role !== "parent") throw new TRPCError({ code: "BAD_REQUEST", message: "Assign the Parent role before linking this account." });
      await db.update(guardians).set({ userId: input.userId }).where(eq(guardians.id, input.guardianId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "guardian.account_linked", entityType: "guardian", entityId: input.guardianId, metadata: { userId: input.userId } });
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), status: z.enum(["active", "transferred", "completed", "inactive"]) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.update(students).set({ status: input.status }).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id)));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.status_updated", entityType: "student", entityId: input.studentId, metadata: { status: input.status } });
      return { success: true };
    }),
    setSubjects: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), subjectIds: z.array(z.number().int().positive()).max(20) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      if (input.subjectIds.length) {
        const permitted = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.schoolId, school.id), inArray(subjects.id, input.subjectIds)));
        if (permitted.length !== input.subjectIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "One or more subjects do not belong to this school." });
      }
      await db.delete(studentSubjects).where(eq(studentSubjects.studentId, input.studentId));
      if (input.subjectIds.length) await db.insert(studentSubjects).values(input.subjectIds.map(subjectId => ({ studentId: input.studentId, subjectId })));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.subjects_updated", entityType: "student", entityId: input.studentId, metadata: { subjectIds: input.subjectIds } });
      return { success: true };
    }),
    uploadDocument: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), fileName: z.string().min(1).max(255), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]), documentType: z.string().min(2).max(50), base64: z.string().min(4) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id, admissionNo: students.admissionNo }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Student not found." });
      const cleaned = input.base64.replace(/^data:[^;]+;base64,/, "");
      const bytes = Buffer.from(cleaned, "base64");
      if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Documents must be between 1 byte and 5 MB." });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { key, url } = await storagePut(`schools/${school.id}/students/${student.admissionNo}/${safeName}`, bytes, input.mimeType);
      await db.insert(studentDocuments).values({ studentId: student.id, uploadedByUserId: ctx.user.id, storageKey: key, url, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: bytes.length, documentType: input.documentType });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.document_uploaded", entityType: "studentDocument", entityId: student.id, metadata: { documentType: input.documentType, storageKey: key } });
      return { key, url };
    }),
  }),

  teachers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      return db.select({ id: teachers.id, employeeNo: teachers.employeeNo, firstName: teachers.firstName, lastName: teachers.lastName, phone: teachers.phone, email: teachers.email, status: teachers.employmentStatus, department: departments.name }).from(teachers).leftJoin(departments, eq(teachers.departmentId, departments.id)).where(eq(teachers.schoolId, school.id)).orderBy(asc(teachers.lastName));
    }),
    create: protectedProcedure.input(z.object({ employeeNo: z.string().min(2).max(40), firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), phone: z.string().max(20).optional(), email: z.string().email().optional(), departmentId: z.number().int().positive().optional(), userId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      if (input.userId) await assertAndBindUserToSchool(db, input.userId, school.id);
      await db.insert(teachers).values({ schoolId: school.id, ...input });
      const [teacher] = await db.select().from(teachers).where(and(eq(teachers.schoolId, school.id), eq(teachers.employeeNo, input.employeeNo))).limit(1);
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.created", entityType: "teacher", entityId: teacher?.id });
      return teacher;
    }),
    workload: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher"]);
      const { db, school } = await getOperatingSchool();
      const teacher = await getTeacherForUser(ctx.user.id);
      const condition = teacher && !administrativeRoles.includes(ctx.user.role as (typeof administrativeRoles)[number]) ? eq(teacherAssignments.teacherId, teacher.id) : eq(teacherAssignments.schoolId, school.id);
      return db.select({ teacherId: teacherAssignments.teacherId, classId: teacherAssignments.classId, subject: subjects.name, form: schoolClasses.form, stream: schoolClasses.stream, firstName: teachers.firstName, lastName: teachers.lastName }).from(teacherAssignments).innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id)).innerJoin(schoolClasses, eq(teacherAssignments.classId, schoolClasses.id)).innerJoin(teachers, eq(teacherAssignments.teacherId, teachers.id)).where(condition).orderBy(asc(teachers.lastName));
    }),
    recordAttendance: protectedProcedure.input(z.object({ teacherId: z.number().int().positive(), attendanceDate: dateSchema, status: z.enum(["present", "absent", "late", "on_leave"]), notes: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, school.id))).limit(1);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found." });
      const [existing] = await db.select({ id: teacherAttendance.id }).from(teacherAttendance).where(and(eq(teacherAttendance.teacherId, input.teacherId), eq(teacherAttendance.attendanceDate, toDate(input.attendanceDate)))).limit(1);
      if (existing) await db.update(teacherAttendance).set({ status: input.status, notes: input.notes, recordedByUserId: ctx.user.id }).where(eq(teacherAttendance.id, existing.id));
      else await db.insert(teacherAttendance).values({ teacherId: input.teacherId, attendanceDate: toDate(input.attendanceDate), status: input.status, notes: input.notes, recordedByUserId: ctx.user.id });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.attendance_recorded", entityType: "teacherAttendance", entityId: input.teacherId, metadata: { attendanceDate: input.attendanceDate, status: input.status } });
      return { success: true };
    }),
    setDepartment: protectedProcedure.input(z.object({ teacherId: z.number().int().positive(), departmentId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, school.id))).limit(1);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found." });
      if (input.departmentId) {
        const [department] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, input.departmentId), eq(departments.schoolId, school.id))).limit(1);
        if (!department) throw new TRPCError({ code: "BAD_REQUEST", message: "Department does not belong to this school." });
      }
      await db.update(teachers).set({ departmentId: input.departmentId }).where(eq(teachers.id, input.teacherId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.department_updated", entityType: "teacher", entityId: input.teacherId, metadata: { departmentId: input.departmentId } });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ teacherId: z.number().int().positive(), employeeNo: z.string().min(2).max(40), firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), phone: z.string().max(20).nullable().optional(), email: z.string().email().nullable().optional(), employmentStatus: z.enum(["active", "on_leave", "inactive"]) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      validateNamedRecordUpdate("teacher", { employeeNo: input.employeeNo, firstName: input.firstName, lastName: input.lastName });
      const { db, school } = await getOperatingSchool();
      const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, school.id))).limit(1);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found." });
      await db.update(teachers).set({ employeeNo: input.employeeNo, firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email, employmentStatus: input.employmentStatus }).where(eq(teachers.id, input.teacherId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.updated", entityType: "teacher", entityId: input.teacherId, metadata: { employeeNo: input.employeeNo, employmentStatus: input.employmentStatus } });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ teacherId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal"]);
      const { db, school } = await getOperatingSchool();
      const [teacher] = await db.select({ id: teachers.id, firstName: teachers.firstName, lastName: teachers.lastName }).from(teachers).where(and(eq(teachers.id, input.teacherId), eq(teachers.schoolId, school.id))).limit(1);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found." });
      const [classLinks, allocationLinks, timetableLinks, attendanceLinks, markLinks, assignmentLinks] = await Promise.all([
        db.select({ id: schoolClasses.id }).from(schoolClasses).where(eq(schoolClasses.classTeacherId, input.teacherId)).limit(1),
        db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(eq(teacherAssignments.teacherId, input.teacherId)).limit(1),
        db.select({ id: timetableSlots.id }).from(timetableSlots).where(eq(timetableSlots.teacherId, input.teacherId)).limit(1),
        db.select({ id: teacherAttendance.id }).from(teacherAttendance).where(eq(teacherAttendance.teacherId, input.teacherId)).limit(1),
        db.select({ id: marks.id }).from(marks).where(eq(marks.teacherId, input.teacherId)).limit(1),
        db.select({ id: assignments.id }).from(assignments).where(eq(assignments.teacherId, input.teacherId)).limit(1),
      ]);
      try {
        assertRecordRemovable("teacher", { classes: Boolean(classLinks.length), allocations: Boolean(allocationLinks.length), timetable: Boolean(timetableLinks.length), attendance: Boolean(attendanceLinks.length), marks: Boolean(markLinks.length), assignments: Boolean(assignmentLinks.length) });
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Teacher has linked operational data." });
      }
      await db.delete(teachers).where(eq(teachers.id, input.teacherId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.removed", entityType: "teacher", entityId: input.teacherId, metadata: { name: `${teacher.firstName} ${teacher.lastName}` } });
      return { success: true };
    }),
  }),

  academics: router({
    config: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      const [years, classRows, subjectRows, departmentRows] = await Promise.all([
        db.select().from(academicYears).where(eq(academicYears.schoolId, school.id)).orderBy(desc(academicYears.startsOn)),
        db.select().from(schoolClasses).where(eq(schoolClasses.schoolId, school.id)).orderBy(asc(schoolClasses.form), asc(schoolClasses.stream)),
        db.select().from(subjects).where(eq(subjects.schoolId, school.id)).orderBy(asc(subjects.name)),
        db.select().from(departments).where(eq(departments.schoolId, school.id)).orderBy(asc(departments.name)),
      ]);
      const termRows = years.length ? await db.select().from(terms).where(inArray(terms.academicYearId, years.map(year => year.id))).orderBy(asc(terms.startsOn)) : [];
      return { school: { ...school, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, academicYears: years, terms: termRows, classes: classRows, subjects: subjectRows, departments: departmentRows };
    }),
    createAcademicYear: protectedProcedure.input(z.object({ name: z.string().regex(/^20\d{2}$/), startsOn: dateSchema, endsOn: dateSchema, isActive: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      if (input.endsOn <= input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "Academic year end date must be after its start date." });
      const { db, school } = await getOperatingSchool();
      if (input.isActive) await db.update(academicYears).set({ isActive: false }).where(eq(academicYears.schoolId, school.id));
      await db.insert(academicYears).values({ schoolId: school.id, name: input.name, startsOn: toDate(input.startsOn), endsOn: toDate(input.endsOn), isActive: input.isActive });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "academic_year.created", entityType: "academicYear", metadata: { name: input.name } });
      return { success: true };
    }),
    createTerm: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), name: z.enum(["Term 1", "Term 2", "Term 3"]), startsOn: dateSchema, endsOn: dateSchema, isActive: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      if (input.endsOn <= input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "Term end date must be after its start date." });
      const { db, school } = await getOperatingSchool();
      const [year] = await db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!year) throw new TRPCError({ code: "NOT_FOUND", message: "Academic year not found." });
      if (input.isActive) await db.update(terms).set({ isActive: false }).where(eq(terms.academicYearId, input.academicYearId));
      await db.insert(terms).values({ academicYearId: input.academicYearId, name: input.name, startsOn: toDate(input.startsOn), endsOn: toDate(input.endsOn), isActive: input.isActive });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "term.created", entityType: "term", metadata: { academicYearId: input.academicYearId, name: input.name } });
      return { success: true };
    }),
    createDepartment: protectedProcedure.input(z.object({ name: z.string().min(2).max(100), code: z.string().min(2).max(20).transform(value => value.toUpperCase()) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.insert(departments).values({ schoolId: school.id, ...input });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "department.created", entityType: "department", metadata: input });
      return { success: true };
    }),
    createClass: protectedProcedure.input(z.object({ form: z.enum(["Form 1", "Form 2", "Form 3", "Form 4"]), stream: z.string().min(1).max(40), capacity: z.number().int().min(1).max(120).default(45) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.insert(schoolClasses).values({ schoolId: school.id, ...input });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "class.created", entityType: "class", metadata: input });
      return { success: true };
    }),
    updateClass: protectedProcedure.input(z.object({ classId: z.number().int().positive(), capacity: z.number().int().min(1).max(120), classTeacherId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      validateClassCapacity(input.capacity);
      const { db, school } = await getOperatingSchool();
      const [schoolClass] = await db.select({ id: schoolClasses.id }).from(schoolClasses).where(and(eq(schoolClasses.id, input.classId), eq(schoolClasses.schoolId, school.id))).limit(1);
      if (!schoolClass) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found." });
      if (input.classTeacherId) {
        const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, input.classTeacherId), eq(teachers.schoolId, school.id), eq(teachers.employmentStatus, "active"))).limit(1);
        try { assertEligibleClassTeacher(Boolean(teacher)); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid class teacher." }); }
      }
      await db.update(schoolClasses).set({ capacity: input.capacity, classTeacherId: input.classTeacherId }).where(eq(schoolClasses.id, input.classId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "class.updated", entityType: "class", entityId: input.classId, metadata: { capacity: input.capacity, classTeacherId: input.classTeacherId } });
      return { success: true };
    }),
    createSubject: protectedProcedure.input(z.object({ code: z.string().min(2).max(20).transform(value => value.toUpperCase()), name: z.string().min(2).max(100), category: z.enum(["compulsory", "optional"]).default("compulsory") })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.insert(subjects).values({ schoolId: school.id, ...input });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "subject.created", entityType: "subject", metadata: input });
      return { success: true };
    }),
    updateSubject: protectedProcedure.input(z.object({ subjectId: z.number().int().positive(), code: z.string().min(2).max(20).transform(value => value.toUpperCase()), name: z.string().min(2).max(100), category: z.enum(["compulsory", "optional"]), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      validateNamedRecordUpdate("subject", { code: input.code, name: input.name });
      const { db, school } = await getOperatingSchool();
      const [subject] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, school.id))).limit(1);
      if (!subject) throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found." });
      await db.update(subjects).set({ code: input.code, name: input.name, category: input.category, isActive: input.isActive }).where(eq(subjects.id, input.subjectId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "subject.updated", entityType: "subject", entityId: input.subjectId, metadata: { code: input.code, name: input.name, category: input.category, isActive: input.isActive } });
      return { success: true };
    }),
    removeSubject: protectedProcedure.input(z.object({ subjectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal"]);
      const { db, school } = await getOperatingSchool();
      const [subject] = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(and(eq(subjects.id, input.subjectId), eq(subjects.schoolId, school.id))).limit(1);
      if (!subject) throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found." });
      const [studentLinks, teacherLinks, markLinks, timetableLinks, assignmentLinks] = await Promise.all([
        db.select({ id: studentSubjects.id }).from(studentSubjects).where(eq(studentSubjects.subjectId, input.subjectId)).limit(1),
        db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(eq(teacherAssignments.subjectId, input.subjectId)).limit(1),
        db.select({ id: marks.id }).from(marks).where(eq(marks.subjectId, input.subjectId)).limit(1),
        db.select({ id: timetableSlots.id }).from(timetableSlots).where(eq(timetableSlots.subjectId, input.subjectId)).limit(1),
        db.select({ id: assignments.id }).from(assignments).where(eq(assignments.subjectId, input.subjectId)).limit(1),
      ]);
      try {
        assertRecordRemovable("subject", { learnerAllocations: Boolean(studentLinks.length), teacherAssignments: Boolean(teacherLinks.length), marks: Boolean(markLinks.length), timetables: Boolean(timetableLinks.length), assignments: Boolean(assignmentLinks.length) });
      } catch (error) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Subject has linked operational data." });
      }
      await db.delete(subjects).where(eq(subjects.id, input.subjectId));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "subject.removed", entityType: "subject", entityId: input.subjectId, metadata: { name: subject.name } });
      return { success: true };
    }),
    assignTeacher: protectedProcedure.input(z.object({ teacherId: z.number().int().positive(), subjectId: z.number().int().positive(), classId: z.number().int().positive(), academicYearId: z.number().int().positive(), termId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.insert(teacherAssignments).values({ schoolId: school.id, ...input });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "teacher.assignment_created", entityType: "teacherAssignment", metadata: input });
      return { success: true };
    }),
    createAssessment: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), title: z.string().min(2).max(140), assessmentType: z.enum(["exam", "test", "assignment"]), maxMarks: z.number().positive().max(1000).default(100), assessmentDate: dateSchema })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      await db.insert(assessments).values({ schoolId: school.id, academicYearId: input.academicYearId, termId: input.termId, classId: input.classId, title: input.title, assessmentType: input.assessmentType, maxMarks: String(input.maxMarks), assessmentDate: toDate(input.assessmentDate), createdByUserId: ctx.user.id });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "assessment.created", entityType: "assessment", metadata: { classId: input.classId, title: input.title } });
      return { success: true };
    }),
    assessmentList: protectedProcedure.input(z.object({ classId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      if (input?.classId) await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const filter = input?.classId ? and(eq(assessments.schoolId, school.id), eq(assessments.classId, input.classId)) : eq(assessments.schoolId, school.id);
      return db.select({ id: assessments.id, title: assessments.title, type: assessments.assessmentType, classId: assessments.classId, maxMarks: assessments.maxMarks, assessmentDate: assessments.assessmentDate, form: schoolClasses.form, stream: schoolClasses.stream }).from(assessments).innerJoin(schoolClasses, eq(assessments.classId, schoolClasses.id)).where(filter).orderBy(desc(assessments.assessmentDate)).limit(100);
    }),
    enterMark: protectedProcedure.input(z.object({ assessmentId: z.number().int().positive(), studentId: z.number().int().positive(), subjectId: z.number().int().positive(), score: z.number().min(0).max(1000), comment: z.string().max(500).optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      const [assessment] = await db.select().from(assessments).where(and(eq(assessments.id, input.assessmentId), eq(assessments.schoolId, school.id))).limit(1);
      if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found." });
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, assessment.classId, input.subjectId);
      const [student] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.currentClassId, assessment.classId))).limit(1);
      if (!student) throw new TRPCError({ code: "BAD_REQUEST", message: "The student is not assigned to the assessment class." });
      if (input.score > Number(assessment.maxMarks)) throw new TRPCError({ code: "BAD_REQUEST", message: "Score cannot exceed maximum marks." });
      const [teacher] = await db.select().from(teachers).where(eq(teachers.userId, ctx.user.id)).limit(1);
      const [assignedTeacher] = await db.select({ teacherId: teacherAssignments.teacherId }).from(teacherAssignments).where(and(eq(teacherAssignments.classId, assessment.classId), eq(teacherAssignments.subjectId, input.subjectId))).limit(1);
      if (!teacher && !assignedTeacher) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Assign a teacher to this class and subject before entering marks." });
      const grade = calculateGrade(input.score, Number(assessment.maxMarks), school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE);
      const values = { assessmentId: input.assessmentId, studentId: input.studentId, subjectId: input.subjectId, teacherId: teacher?.id ?? assignedTeacher.teacherId, score: String(input.score), grade: grade.grade, gradePoints: grade.points, comment: input.comment };
      const [existing] = await db.select({ id: marks.id }).from(marks).where(and(eq(marks.assessmentId, input.assessmentId), eq(marks.studentId, input.studentId), eq(marks.subjectId, input.subjectId))).limit(1);
      if (existing) await db.update(marks).set({ score: values.score, grade: values.grade, gradePoints: values.gradePoints, comment: values.comment, teacherId: values.teacherId }).where(eq(marks.id, existing.id));
      else await db.insert(marks).values(values);
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: existing ? "mark.updated" : "mark.entered", entityType: "mark", entityId: existing?.id, metadata: { assessmentId: input.assessmentId, studentId: input.studentId, subjectId: input.subjectId, grade: grade.grade } });
      return grade;
    }),
    results: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertStudentVisibility(ctx.user.id, ctx.user.role, input.studentId);
      const { db } = await getOperatingSchool();
      const resultRows = await db.select({ score: marks.score, grade: marks.grade, gradePoints: marks.gradePoints, subject: subjects.name, assessment: assessments.title, maxMarks: assessments.maxMarks, date: assessments.assessmentDate }).from(marks).innerJoin(subjects, eq(marks.subjectId, subjects.id)).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).where(eq(marks.studentId, input.studentId)).orderBy(desc(assessments.assessmentDate));
      return { rows: resultRows, summary: summarizeMarks(resultRows.map(row => ({ score: Number(row.score), maxMarks: Number(row.maxMarks), points: row.gradePoints }))) };
    }),
    performance: protectedProcedure.input(z.object({ classId: z.number().int().positive(), subjectId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId, input.subjectId);
      const { db } = await getOperatingSchool();
      const rows = await db.select({ subjectId: subjects.id, subject: subjects.name, score: marks.score, maxMarks: assessments.maxMarks, points: marks.gradePoints }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(and(eq(assessments.classId, input.classId), ...(input.subjectId ? [eq(marks.subjectId, input.subjectId)] : [])));
      const grouped = new Map<number, { subject: string; entries: Array<{ score: number; maxMarks: number; points: number }> }>();
      for (const row of rows) {
        const entry = grouped.get(row.subjectId) ?? { subject: row.subject, entries: [] };
        entry.entries.push({ score: Number(row.score), maxMarks: Number(row.maxMarks), points: row.points });
        grouped.set(row.subjectId, entry);
      }
      return Array.from(grouped.entries()).map(([subjectId, value]) => ({ subjectId, subject: value.subject, learnersMarked: value.entries.length, ...summarizeMarks(value.entries) }));
    }),
    classPerformanceOverview: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const [term] = await db.select({ id: terms.id }).from(terms).innerJoin(academicYears, eq(terms.academicYearId, academicYears.id)).where(and(eq(terms.id, input.termId), eq(terms.academicYearId, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!term) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a term that belongs to the selected academic year in this school." });
      const classRows = await db.select({ id: schoolClasses.id, form: schoolClasses.form, stream: schoolClasses.stream }).from(schoolClasses).where(eq(schoolClasses.schoolId, school.id)).orderBy(asc(schoolClasses.form), asc(schoolClasses.stream));
      const rows = await db.select({ classId: assessments.classId, subjectId: subjects.id, subject: subjects.name, score: marks.score, maxMarks: assessments.maxMarks, points: marks.gradePoints }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(and(eq(assessments.schoolId, school.id), eq(assessments.academicYearId, input.academicYearId), eq(assessments.termId, input.termId)));
      const calculate = (entries: Array<{ score: string; maxMarks: string; points: number }>) => {
        const summary = summarizePerformanceEntries(entries);
        return { ...summary, meanGrade: summary.entries ? calculateGrade(summary.averagePercentage, 100, school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE).grade : null };
      };
      const classSummaries = classRows.map(classRow => ({ classId: classRow.id, form: classRow.form, stream: classRow.stream, ...calculate(rows.filter(row => row.classId === classRow.id)) }));
      const subjectsById = new Map<number, Array<{ score: string; maxMarks: string; points: number }>>();
      const subjectNames = new Map<number, string>();
      for (const row of rows) { subjectsById.set(row.subjectId, [...(subjectsById.get(row.subjectId) ?? []), row]); subjectNames.set(row.subjectId, row.subject); }
      const subjectRanking = Array.from(subjectsById.entries()).map(([subjectId, entries]) => ({ subjectId, subject: subjectNames.get(subjectId) ?? "Subject", ...calculate(entries) })).sort((left, right) => right.averagePercentage - left.averagePercentage || right.meanPoints - left.meanPoints || left.subject.localeCompare(right.subject)).map((row, index) => ({ ...row, rank: index + 1 }));
      return { classSummaries, subjectRanking, totalMarkEntries: rows.length };
    }),
    classPerformanceTrends: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      const yearRows = await db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!yearRows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an academic year belonging to this school." });
      const classRows = await db.select({ id: schoolClasses.id, form: schoolClasses.form, stream: schoolClasses.stream }).from(schoolClasses).where(eq(schoolClasses.schoolId, school.id)).orderBy(asc(schoolClasses.form), asc(schoolClasses.stream));
      const termRows = await db.select({ id: terms.id, name: terms.name, startsOn: terms.startsOn }).from(terms).where(eq(terms.academicYearId, input.academicYearId)).orderBy(asc(terms.startsOn));
      const termIds = termRows.map(term => term.id);
      const classIds = classRows.map(schoolClass => schoolClass.id);
      const rows = termIds.length && classIds.length ? await db.select({ classId: assessments.classId, termId: assessments.termId, score: marks.score, maxMarks: assessments.maxMarks, points: marks.gradePoints }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).where(and(eq(assessments.schoolId, school.id), eq(assessments.academicYearId, input.academicYearId), inArray(assessments.classId, classIds), inArray(assessments.termId, termIds))) : [];
      const classTrends = classRows.map(classRecord => ({ class: classRecord, points: buildTermPerformanceTrend(termRows, rows.filter(row => row.classId === classRecord.id).map(row => ({ termId: row.termId, score: row.score, maxMarks: row.maxMarks, points: row.points }))).map(point => ({ ...point, meanGrade: point.entries ? calculateGrade(point.averagePercentage, 100, school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE).grade : null })) }));
      return { academicYearId: input.academicYearId, classTrends };
    }),
  }),

  reportCards: router({
    preview: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), title: z.string().trim().min(2).max(140).optional(), teacherComment: z.string().trim().max(1200).optional() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const [student] = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo, currentClassId: students.currentClassId }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Learner not found in this school." });
      if (student.currentClassId !== input.classId) throw new TRPCError({ code: "BAD_REQUEST", message: "The learner must belong to the selected class." });
      const [classRecord] = await db.select({ id: schoolClasses.id, form: schoolClasses.form, stream: schoolClasses.stream }).from(schoolClasses).where(and(eq(schoolClasses.id, input.classId), eq(schoolClasses.schoolId, school.id))).limit(1);
      if (!classRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found in this school." });
      const [termRecord] = await db.select({ id: terms.id, name: terms.name, academicYearId: terms.academicYearId }).from(terms).innerJoin(academicYears, eq(terms.academicYearId, academicYears.id)).where(and(eq(terms.id, input.termId), eq(terms.academicYearId, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!termRecord) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a term from the selected academic year." });
      const markRows = await db.select({ subjectId: subjects.id, subject: subjects.name, subjectCode: subjects.code, assessment: assessments.title, assessmentDate: assessments.assessmentDate, score: marks.score, maxMarks: assessments.maxMarks, grade: marks.grade, gradePoints: marks.gradePoints, comment: marks.comment }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(and(eq(assessments.schoolId, school.id), eq(assessments.academicYearId, input.academicYearId), eq(assessments.termId, input.termId), eq(assessments.classId, input.classId), eq(marks.studentId, input.studentId))).orderBy(asc(subjects.name), asc(assessments.assessmentDate));
      if (!markRows.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter at least one mark for this learner before previewing a report card." });
      const resultSnapshot = markRows.map(row => ({ subjectId: row.subjectId, subject: row.subject, subjectCode: row.subjectCode, score: Number(row.score), maxMarks: Number(row.maxMarks), grade: row.grade, gradePoints: row.gradePoints, assessment: row.assessment, assessmentDate: row.assessmentDate.toISOString().slice(0, 10), comment: row.comment ?? null }));
      const summary = summarizeMarks(resultSnapshot.map(row => ({ score: row.score, maxMarks: row.maxMarks, points: row.gradePoints })));
      return { school: { name: school.name, code: school.code, phone: school.phone, email: school.email, address: school.address, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, student, classRecord, term: termRecord, title: input.title?.trim() || `${termRecord.name} Report Card`, resultSnapshot, totalMarks: summary.total, averagePercentage: summary.average, meanPoints: summary.meanPoints, overallGrade: calculateGrade(summary.average, 100, school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE).grade, teacherComment: input.teacherComment?.trim() || null };
    }),
    batchGenerate: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), title: z.string().trim().min(2).max(140).optional(), teacherComment: z.string().trim().max(1200).optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const [classRecord] = await db.select({ id: schoolClasses.id, form: schoolClasses.form, stream: schoolClasses.stream }).from(schoolClasses).where(and(eq(schoolClasses.id, input.classId), eq(schoolClasses.schoolId, school.id))).limit(1);
      if (!classRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found in this school." });
      const [termRecord] = await db.select({ id: terms.id, name: terms.name, academicYearId: terms.academicYearId }).from(terms).innerJoin(academicYears, eq(terms.academicYearId, academicYears.id)).where(and(eq(terms.id, input.termId), eq(terms.academicYearId, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!termRecord) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a term from the selected academic year." });
      const classStudents = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo }).from(students).where(and(eq(students.schoolId, school.id), eq(students.currentClassId, input.classId), eq(students.status, "active"))).orderBy(asc(students.lastName), asc(students.firstName));
      if (!classStudents.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "There are no active learners in the selected class." });
      const results: Array<{ studentId: number; learner: string; admissionNo: string; status: "created" | "updated" | "skipped"; reason?: string }> = [];
      let created = 0;
      let updated = 0;
      const markRows = await db.select({ studentId: marks.studentId, subjectId: subjects.id, subject: subjects.name, subjectCode: subjects.code, assessment: assessments.title, assessmentDate: assessments.assessmentDate, score: marks.score, maxMarks: assessments.maxMarks, grade: marks.grade, gradePoints: marks.gradePoints, comment: marks.comment }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(and(eq(assessments.schoolId, school.id), eq(assessments.academicYearId, input.academicYearId), eq(assessments.termId, input.termId), eq(assessments.classId, input.classId))).orderBy(asc(marks.studentId), asc(subjects.name), asc(assessments.assessmentDate));
      for (const student of classStudents) {
        const learnerMarks = markRows.filter(row => row.studentId === student.id);
        const learner = `${student.firstName} ${student.lastName}`;
        if (!learnerMarks.length) {
          results.push({ studentId: student.id, learner, admissionNo: student.admissionNo, status: "skipped", reason: "No marks entered for this learner." });
          continue;
        }
        const resultSnapshot = learnerMarks.map(row => ({ subjectId: row.subjectId, subject: row.subject, subjectCode: row.subjectCode, score: Number(row.score), maxMarks: Number(row.maxMarks), grade: row.grade, gradePoints: row.gradePoints, assessment: row.assessment, assessmentDate: row.assessmentDate.toISOString().slice(0, 10), comment: row.comment ?? null }));
        const summary = summarizeMarks(resultSnapshot.map(row => ({ score: row.score, maxMarks: row.maxMarks, points: row.gradePoints })));
        const values = { title: input.title?.trim() || `${termRecord.name} Report Card`, resultSnapshot, totalMarks: String(summary.total), averagePercentage: String(summary.average), meanPoints: String(summary.meanPoints), overallGrade: calculateGrade(summary.average, 100, school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE).grade, teacherComment: input.teacherComment?.trim() || null, publishedAt: null, updatedByUserId: ctx.user.id };
        const [existing] = await db.select({ id: reportCards.id }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.studentId, student.id), eq(reportCards.termId, input.termId))).limit(1);
        if (existing) {
          await db.update(reportCards).set(values).where(eq(reportCards.id, existing.id));
          updated += 1;
          results.push({ studentId: student.id, learner, admissionNo: student.admissionNo, status: "updated" });
        } else {
          await db.insert(reportCards).values({ schoolId: school.id, studentId: student.id, academicYearId: input.academicYearId, termId: input.termId, classId: input.classId, createdByUserId: ctx.user.id, ...values });
          created += 1;
          results.push({ studentId: student.id, learner, admissionNo: student.admissionNo, status: "created" });
        }
      }
      const skipped = results.length - created - updated;
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "report_card.batch_generated", entityType: "reportCard", metadata: { classId: input.classId, academicYearId: input.academicYearId, termId: input.termId, totalLearners: classStudents.length, created, updated, skipped } });
      return { success: true, created, updated, skipped, results };
    }),
    batchStatus: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const rows = await db.select({ id: reportCards.id, publishedAt: reportCards.publishedAt }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.academicYearId, input.academicYearId), eq(reportCards.termId, input.termId), eq(reportCards.classId, input.classId)));
      const published = rows.filter(row => Boolean(row.publishedAt)).length;
      return { total: rows.length, published, drafts: rows.length - published };
    }),
    publishBatch: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const drafts = await db.select({ id: reportCards.id }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.academicYearId, input.academicYearId), eq(reportCards.termId, input.termId), eq(reportCards.classId, input.classId), isNull(reportCards.publishedAt)));
      if (!drafts.length) return { success: true, published: 0, message: "No unpublished report cards are waiting for release." };
      const publishedAt = new Date();
      await db.update(reportCards).set({ publishedAt, updatedByUserId: ctx.user.id }).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.academicYearId, input.academicYearId), eq(reportCards.termId, input.termId), eq(reportCards.classId, input.classId), isNull(reportCards.publishedAt)));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "report_card.batch_published", entityType: "reportCard", metadata: { classId: input.classId, academicYearId: input.academicYearId, termId: input.termId, count: drafts.length } });
      return { success: true, published: drafts.length, message: `${drafts.length} report card${drafts.length === 1 ? "" : "s"} released to learners.` };
    }),
    unpublishBatch: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const published = await db.select({ id: reportCards.id }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.academicYearId, input.academicYearId), eq(reportCards.termId, input.termId), eq(reportCards.classId, input.classId), isNotNull(reportCards.publishedAt)));
      if (!published.length) return { success: true, unpublished: 0, message: "No published report cards were found for this batch." };
      await db.update(reportCards).set({ publishedAt: null, updatedByUserId: ctx.user.id }).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.academicYearId, input.academicYearId), eq(reportCards.termId, input.termId), eq(reportCards.classId, input.classId), isNotNull(reportCards.publishedAt)));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "report_card.batch_unpublished", entityType: "reportCard", metadata: { classId: input.classId, academicYearId: input.academicYearId, termId: input.termId, count: published.length } });
      return { success: true, unpublished: published.length, message: `${published.length} report card${published.length === 1 ? "" : "s"} returned to draft review.` };
    }),
    create: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), title: z.string().trim().min(2).max(140).optional(), teacherComment: z.string().trim().max(1200).optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const [student] = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo, currentClassId: students.currentClassId }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Learner not found in this school." });
      if (student.currentClassId !== input.classId) throw new TRPCError({ code: "BAD_REQUEST", message: "The learner must belong to the selected class." });
      const [classRecord] = await db.select({ id: schoolClasses.id, form: schoolClasses.form, stream: schoolClasses.stream }).from(schoolClasses).where(and(eq(schoolClasses.id, input.classId), eq(schoolClasses.schoolId, school.id))).limit(1);
      if (!classRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Class not found in this school." });
      const [termRecord] = await db.select({ id: terms.id, name: terms.name, academicYearId: terms.academicYearId }).from(terms).innerJoin(academicYears, eq(terms.academicYearId, academicYears.id)).where(and(eq(terms.id, input.termId), eq(terms.academicYearId, input.academicYearId), eq(academicYears.schoolId, school.id))).limit(1);
      if (!termRecord) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a term from the selected academic year." });
      const markRows = await db.select({ subjectId: subjects.id, subject: subjects.name, subjectCode: subjects.code, assessment: assessments.title, assessmentDate: assessments.assessmentDate, score: marks.score, maxMarks: assessments.maxMarks, grade: marks.grade, gradePoints: marks.gradePoints, comment: marks.comment }).from(marks).innerJoin(assessments, eq(marks.assessmentId, assessments.id)).innerJoin(subjects, eq(marks.subjectId, subjects.id)).where(and(eq(assessments.schoolId, school.id), eq(assessments.academicYearId, input.academicYearId), eq(assessments.termId, input.termId), eq(assessments.classId, input.classId), eq(marks.studentId, input.studentId))).orderBy(asc(subjects.name), asc(assessments.assessmentDate));
      if (!markRows.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter at least one mark for this learner before creating a report card." });
      const resultSnapshot = markRows.map(row => ({ subjectId: row.subjectId, subject: row.subject, subjectCode: row.subjectCode, score: Number(row.score), maxMarks: Number(row.maxMarks), grade: row.grade, gradePoints: row.gradePoints, assessment: row.assessment, assessmentDate: row.assessmentDate.toISOString().slice(0, 10), comment: row.comment ?? null }));
      const summary = summarizeMarks(resultSnapshot.map(row => ({ score: row.score, maxMarks: row.maxMarks, points: row.gradePoints })));
      const overallGrade = calculateGrade(summary.average, 100, school.gradeScale ?? DEFAULT_KENYAN_GRADING_SCALE).grade;
      const values = { title: input.title?.trim() || `${termRecord.name} Report Card`, resultSnapshot, totalMarks: String(summary.total), averagePercentage: String(summary.average), meanPoints: String(summary.meanPoints), overallGrade, teacherComment: input.teacherComment?.trim() || null, updatedByUserId: ctx.user.id };
      const [existing] = await db.select({ id: reportCards.id }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.studentId, input.studentId), eq(reportCards.termId, input.termId))).limit(1);
      if (existing) await db.update(reportCards).set(values).where(eq(reportCards.id, existing.id));
      else await db.insert(reportCards).values({ schoolId: school.id, studentId: input.studentId, academicYearId: input.academicYearId, termId: input.termId, classId: input.classId, createdByUserId: ctx.user.id, ...values });
      const [saved] = await db.select({ id: reportCards.id }).from(reportCards).where(and(eq(reportCards.schoolId, school.id), eq(reportCards.studentId, input.studentId), eq(reportCards.termId, input.termId))).limit(1);
      if (!saved) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Report card could not be saved." });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: existing ? "report_card.updated" : "report_card.created", entityType: "reportCard", entityId: saved.id, metadata: { studentId: student.id, academicYearId: input.academicYearId, termId: input.termId, classId: classRecord.id, subjectCount: resultSnapshot.length, average: summary.average, overallGrade } });
      return { success: true, reportCardId: saved.id, updated: Boolean(existing) };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["student"]);
      const { db, school } = await getOperatingSchool();
      const studentIds = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      if (!studentIds.length) return { school: { name: school.name, code: school.code, phone: school.phone, email: school.email, address: school.address, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, reportCards: [] };
      const rows = await db.select({ id: reportCards.id, studentId: reportCards.studentId, studentFirstName: students.firstName, studentLastName: students.lastName, admissionNo: students.admissionNo, title: reportCards.title, academicYearId: reportCards.academicYearId, academicYear: academicYears.name, termId: reportCards.termId, term: terms.name, form: schoolClasses.form, stream: schoolClasses.stream, resultSnapshot: reportCards.resultSnapshot, totalMarks: reportCards.totalMarks, averagePercentage: reportCards.averagePercentage, meanPoints: reportCards.meanPoints, overallGrade: reportCards.overallGrade, teacherComment: reportCards.teacherComment, publishedAt: reportCards.publishedAt }).from(reportCards).innerJoin(students, eq(reportCards.studentId, students.id)).innerJoin(academicYears, eq(reportCards.academicYearId, academicYears.id)).innerJoin(terms, eq(reportCards.termId, terms.id)).innerJoin(schoolClasses, eq(reportCards.classId, schoolClasses.id)).where(and(eq(reportCards.schoolId, school.id), inArray(reportCards.studentId, studentIds), isNotNull(reportCards.publishedAt))).orderBy(desc(reportCards.publishedAt)).limit(20);
      return { school: { name: school.name, code: school.code, phone: school.phone, email: school.email, address: school.address, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, reportCards: rows };
    }),
    exportPdf: protectedProcedure.input(z.object({ reportCardId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["student"]);
      const { db, school } = await getOperatingSchool();
      const studentIds = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      if (!studentIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Report card not found." });
      const [reportCard] = await db.select({ id: reportCards.id, schoolId: reportCards.schoolId, studentId: reportCards.studentId }).from(reportCards).where(and(eq(reportCards.id, input.reportCardId), eq(reportCards.schoolId, school.id), inArray(reportCards.studentId, studentIds))).limit(1);
      if (!reportCard || reportCard.schoolId !== school.id) throw new TRPCError({ code: "NOT_FOUND", message: "Report card not found." });
      await db.insert(reportExports).values({ schoolId: school.id, userId: ctx.user.id, reportType: "student_report_card", format: "pdf", filters: { reportCardId: String(input.reportCardId), studentId: String(reportCard.studentId) } });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "student.report_card_generated", entityType: "reportCard", entityId: input.reportCardId, metadata: { studentId: reportCard.studentId, format: "pdf" } });
      return { success: true };
    }),
  }),

  attendance: router({
    mark: protectedProcedure.input(z.object({ classId: z.number().int().positive(), attendanceDate: dateSchema, records: z.array(z.object({ studentId: z.number().int().positive(), status: z.enum(["present", "absent", "late"]), absenceReason: z.string().max(300).optional() })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      const { db, school } = await getOperatingSchool();
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const classStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.currentClassId, input.classId), eq(students.schoolId, school.id)));
      const allowed = new Set(classStudents.map(row => row.id));
      if (input.records.some(record => !allowed.has(record.studentId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Attendance may only be recorded for students in the selected class." });
      for (const record of input.records) {
        const attendanceDate = toDate(input.attendanceDate);
        const [existing] = await db.select({ id: attendanceRecords.id }).from(attendanceRecords).where(and(eq(attendanceRecords.studentId, record.studentId), eq(attendanceRecords.attendanceDate, attendanceDate))).limit(1);
        if (existing) await db.update(attendanceRecords).set({ classId: input.classId, status: record.status, absenceReason: record.absenceReason, markedByUserId: ctx.user.id }).where(eq(attendanceRecords.id, existing.id));
        else await db.insert(attendanceRecords).values({ classId: input.classId, studentId: record.studentId, attendanceDate, status: record.status, absenceReason: record.absenceReason, markedByUserId: ctx.user.id });
      }
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "attendance.recorded", entityType: "attendance", metadata: { classId: input.classId, attendanceDate: input.attendanceDate, count: input.records.length } });
      return { saved: input.records.length };
    }),
    classSummary: protectedProcedure.input(z.object({ classId: z.number().int().positive(), from: dateSchema.optional(), to: dateSchema.optional() })).query(async ({ ctx, input }) => {
      requireRole(ctx.user, academicRoles);
      await assertTeacherAssignment(ctx.user.id, ctx.user.role, input.classId);
      const { db } = await getOperatingSchool();
      const rows = await db.select({ studentId: attendanceRecords.studentId, status: attendanceRecords.status, date: attendanceRecords.attendanceDate }).from(attendanceRecords).where(eq(attendanceRecords.classId, input.classId));
      const filtered = rows.filter(row => {
        const date = row.date.toISOString().slice(0, 10);
        return (!input.from || date >= input.from) && (!input.to || date <= input.to);
      });
      return { records: filtered, ...summarizeAttendance(filtered.map(row => ({ studentId: row.studentId, status: row.status }))) };
    }),
  }),

  finance: router({
    structures: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      return db.select({ id: feeStructures.id, name: feeStructures.name, amount: feeStructures.amount, classId: feeStructures.classId, academicYearId: feeStructures.academicYearId, termId: feeStructures.termId, dueDate: feeStructures.dueDate }).from(feeStructures).where(eq(feeStructures.schoolId, school.id)).orderBy(desc(feeStructures.createdAt)).limit(200);
    }),
    createFeeStructure: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), name: z.string().min(2).max(120), amount: z.number().positive().max(10_000_000), dueDate: dateSchema.optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      await db.insert(feeStructures).values({ schoolId: school.id, academicYearId: input.academicYearId, termId: input.termId, classId: input.classId, name: input.name, amount: String(input.amount), dueDate: input.dueDate ? toDate(input.dueDate) : undefined });
      const [structure] = await db.select().from(feeStructures).where(and(eq(feeStructures.schoolId, school.id), eq(feeStructures.name, input.name))).orderBy(desc(feeStructures.id)).limit(1);
      const classStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.currentClassId, input.classId), eq(students.status, "active")));
      if (structure && classStudents.length) await db.insert(studentFeeAccounts).values(classStudents.map(student => ({ studentId: student.id, feeStructureId: structure.id, amountDue: String(input.amount), dueDate: input.dueDate ? toDate(input.dueDate) : undefined })));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "fee_structure.created", entityType: "feeStructure", entityId: structure?.id, metadata: { classId: input.classId, amount: input.amount } });
      return { feeStructureId: structure?.id, accountsCreated: classStudents.length };
    }),
    createAccount: protectedProcedure.input(z.object({ studentId: z.number().int().positive(), feeStructureId: z.number().int().positive(), amountDue: z.number().positive().max(10_000_000), dueDate: dateSchema.optional() })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id, currentClassId: students.currentClassId }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      const [structure] = await db.select({ id: feeStructures.id, classId: feeStructures.classId }).from(feeStructures).where(and(eq(feeStructures.id, input.feeStructureId), eq(feeStructures.schoolId, school.id))).limit(1);
      if (!student || !structure) throw new TRPCError({ code: "NOT_FOUND", message: "Learner or fee structure not found." });
      if (!student.currentClassId || student.currentClassId !== structure.classId) throw new TRPCError({ code: "BAD_REQUEST", message: "The fee structure must belong to the learner's current class." });
      const [existing] = await db.select({ id: studentFeeAccounts.id }).from(studentFeeAccounts).where(and(eq(studentFeeAccounts.studentId, input.studentId), eq(studentFeeAccounts.feeStructureId, input.feeStructureId))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "This learner already has an account for the selected fee structure. Use the balance correction workflow instead." });
      await db.insert(studentFeeAccounts).values({ studentId: input.studentId, feeStructureId: input.feeStructureId, amountDue: String(input.amountDue), dueDate: input.dueDate ? toDate(input.dueDate) : undefined, status: "unpaid" });
      const [account] = await db.select({ id: studentFeeAccounts.id }).from(studentFeeAccounts).where(and(eq(studentFeeAccounts.studentId, input.studentId), eq(studentFeeAccounts.feeStructureId, input.feeStructureId))).orderBy(desc(studentFeeAccounts.id)).limit(1);
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "fee_account.created", entityType: "studentFeeAccount", entityId: account?.id, metadata: { studentId: input.studentId, feeStructureId: input.feeStructureId, amountDue: input.amountDue, dueDate: input.dueDate } });
      return { success: true, accountId: account?.id };
    }),
    recordPayment: protectedProcedure.input(z.object({ studentFeeAccountId: z.number().int().positive(), amount: z.number().positive().max(10_000_000), method: z.enum(["mpesa", "bank", "cash", "other"]), reference: z.string().max(100).optional(), payerName: z.string().max(160).optional(), paymentDate: dateSchema })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      const [account] = await db.select({ id: studentFeeAccounts.id, studentId: studentFeeAccounts.studentId, amountDue: studentFeeAccounts.amountDue, amountPaid: studentFeeAccounts.amountPaid }).from(studentFeeAccounts).innerJoin(students, eq(studentFeeAccounts.studentId, students.id)).where(and(eq(studentFeeAccounts.id, input.studentFeeAccountId), eq(students.schoolId, school.id))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Fee account not found." });
      const paymentUpdate = applyPayment(Number(account.amountDue), Number(account.amountPaid), input.amount);
      const receiptNo = receiptNumber();
      await db.insert(payments).values({ studentFeeAccountId: account.id, studentId: account.studentId, amount: String(input.amount), method: input.method, reference: input.reference, payerName: input.payerName, receiptNo, paymentDate: toDate(input.paymentDate), receivedByUserId: ctx.user.id, providerReference: input.method === "mpesa" ? input.reference : undefined });
      const [payment] = await db.select().from(payments).where(eq(payments.receiptNo, receiptNo)).limit(1);
      await db.update(studentFeeAccounts).set({ amountPaid: String(paymentUpdate.newPaid), status: paymentUpdate.status }).where(eq(studentFeeAccounts.id, account.id));
      if (payment) await db.insert(receipts).values({ paymentId: payment.id, receiptNo, issuedByUserId: ctx.user.id });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "payment.recorded", entityType: "payment", entityId: payment?.id, metadata: { receiptNo, method: input.method, amount: input.amount } });
      return { receiptNo, balance: paymentUpdate.balance };
    }),
    adjustAccount: protectedProcedure.input(z.object({ studentFeeAccountId: z.number().int().positive(), amountDue: z.number().min(0).max(10_000_000), reason: z.string().min(5).max(500) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "bursar"]);
      const { db, school } = await getOperatingSchool();
      const [account] = await db.select({ id: studentFeeAccounts.id, amountDue: studentFeeAccounts.amountDue, amountPaid: studentFeeAccounts.amountPaid }).from(studentFeeAccounts).innerJoin(students, eq(studentFeeAccounts.studentId, students.id)).where(and(eq(studentFeeAccounts.id, input.studentFeeAccountId), eq(students.schoolId, school.id))).limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Fee account not found." });
      const paid = Number(account.amountPaid);
      let adjustment: ReturnType<typeof adjustFeeDue>;
      try {
        adjustment = adjustFeeDue(paid, input.amountDue);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? `${error.message} Issue a documented refund or credit separately.` : "Invalid fee adjustment." });
      }
      await db.update(studentFeeAccounts).set({ amountDue: String(input.amountDue), status: adjustment.status }).where(eq(studentFeeAccounts.id, account.id));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "fee_account.adjusted", entityType: "studentFeeAccount", entityId: account.id, metadata: { previousAmountDue: Number(account.amountDue), newAmountDue: input.amountDue, amountPaid: paid, reason: input.reason } });
      return { success: true, balance: adjustment.balance };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "parent" && ctx.user.role !== "student") requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      const linked = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      if ((ctx.user.role === "parent" || ctx.user.role === "student") && !linked.length) return [];
      const condition = linked.length ? inArray(studentFeeAccounts.studentId, linked) : eq(students.schoolId, school.id);
      return db.select({ id: studentFeeAccounts.id, studentId: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo, due: studentFeeAccounts.amountDue, paid: studentFeeAccounts.amountPaid, status: studentFeeAccounts.status, feeName: feeStructures.name }).from(studentFeeAccounts).innerJoin(students, eq(studentFeeAccounts.studentId, students.id)).innerJoin(feeStructures, eq(studentFeeAccounts.feeStructureId, feeStructures.id)).where(condition).orderBy(asc(students.lastName));
    }),
    payments: protectedProcedure.input(z.object({ studentId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      return db.select({ id: payments.id, studentId: payments.studentId, receiptNo: payments.receiptNo, amount: payments.amount, method: payments.method, reference: payments.reference, payerName: payments.payerName, paymentDate: payments.paymentDate, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo, feeName: feeStructures.name }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).innerJoin(studentFeeAccounts, eq(payments.studentFeeAccountId, studentFeeAccounts.id)).innerJoin(feeStructures, eq(studentFeeAccounts.feeStructureId, feeStructures.id)).where(and(eq(students.schoolId, school.id), ...(input?.studentId ? [eq(payments.studentId, input.studentId)] : []))).orderBy(desc(payments.paymentDate), desc(payments.id)).limit(200);
    }),
    studentStatement: protectedProcedure.input(z.object({ studentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertStudentVisibility(ctx.user.id, ctx.user.role, input.studentId);
      const { db, school } = await getOperatingSchool();
      const [student] = await db.select({ id: students.id, admissionNo: students.admissionNo, firstName: students.firstName, lastName: students.lastName }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Learner not found." });
      const [accounts, paymentRows] = await Promise.all([
        db.select({ feeName: feeStructures.name, due: studentFeeAccounts.amountDue, paid: studentFeeAccounts.amountPaid, status: studentFeeAccounts.status }).from(studentFeeAccounts).innerJoin(feeStructures, eq(studentFeeAccounts.feeStructureId, feeStructures.id)).where(eq(studentFeeAccounts.studentId, input.studentId)),
        db.select({ id: payments.id, receiptNo: payments.receiptNo, amount: payments.amount, method: payments.method, paymentDate: payments.paymentDate, reference: payments.reference, payerName: payments.payerName }).from(payments).where(eq(payments.studentId, input.studentId)).orderBy(desc(payments.paymentDate)),
      ]);
      return { school: { name: school.name, code: school.code, phone: school.phone, email: school.email, address: school.address, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, student, accounts, payments: paymentRows, balance: accounts.reduce((sum, account) => sum + Number(account.due) - Number(account.paid), 0) };
    }),
    paymentReceipt: protectedProcedure.input(z.object({ paymentId: z.number().int().positive(), studentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertStudentVisibility(ctx.user.id, ctx.user.role, input.studentId);
      const { db, school } = await getOperatingSchool();
      const [receipt] = await db.select({ paymentId: payments.id, studentId: payments.studentId, receiptNo: payments.receiptNo, amount: payments.amount, method: payments.method, reference: payments.reference, payerName: payments.payerName, paymentDate: payments.paymentDate, providerReference: payments.providerReference, feeName: feeStructures.name, amountDue: studentFeeAccounts.amountDue, amountPaid: studentFeeAccounts.amountPaid, issuedAt: receipts.issuedAt }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).innerJoin(studentFeeAccounts, eq(payments.studentFeeAccountId, studentFeeAccounts.id)).innerJoin(feeStructures, eq(studentFeeAccounts.feeStructureId, feeStructures.id)).leftJoin(receipts, eq(receipts.paymentId, payments.id)).where(and(eq(payments.id, input.paymentId), eq(payments.studentId, input.studentId), eq(students.schoolId, school.id))).limit(1);
      if (!receipt || receipt.studentId !== input.studentId) throw new TRPCError({ code: "NOT_FOUND", message: "Payment receipt not found for this learner." });
      return { school: { name: school.name, code: school.code, phone: school.phone, email: school.email, address: school.address, logoUrl: school.logoKey ? `/manus-storage/${school.logoKey}` : null }, receipt: { ...receipt, balance: Number(receipt.amountDue) - Number(receipt.amountPaid) } };
    }),
    recordDocument: protectedProcedure.input(z.object({ documentType: z.enum(["statement", "receipt"]), studentId: z.number().int().positive(), paymentId: z.number().int().positive().optional(), format: z.enum(["pdf", "excel"]).default("pdf") })).mutation(async ({ ctx, input }) => {
      await assertStudentVisibility(ctx.user.id, ctx.user.role, input.studentId);
      const { db, school } = await getOperatingSchool();
      if (input.documentType === "receipt" && !input.paymentId) throw new TRPCError({ code: "BAD_REQUEST", message: "A payment is required for a receipt." });
      if (input.paymentId) {
        const [payment] = await db.select({ id: payments.id }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(and(eq(payments.id, input.paymentId), eq(payments.studentId, input.studentId), eq(students.schoolId, school.id))).limit(1);
        if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found for this learner." });
      }
      await db.insert(reportExports).values({ schoolId: school.id, userId: ctx.user.id, reportType: input.documentType === "statement" ? "learner_statement" : "payment_receipt", format: input.format, filters: { studentId: String(input.studentId), ...(input.paymentId ? { paymentId: String(input.paymentId) } : {}) } });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: `finance.${input.documentType}_generated`, entityType: input.documentType === "statement" ? "studentFeeAccount" : "payment", entityId: input.paymentId ?? input.studentId, metadata: { studentId: input.studentId, paymentId: input.paymentId, format: input.format } });
      return { success: true };
    }),
    collectionSummary: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, financeRoles);
      const { db, school } = await getOperatingSchool();
      const paymentRows = await db.select({ amount: payments.amount, method: payments.method }).from(payments).innerJoin(students, eq(payments.studentId, students.id)).where(eq(students.schoolId, school.id));
      const byMethod = paymentRows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.method]: (acc[row.method] ?? 0) + Number(row.amount) }), {});
      return { total: paymentRows.reduce((sum, row) => sum + Number(row.amount), 0), byMethod, payments: paymentRows.length };
    }),
  }),

  timetable: router({
    createSlot: protectedProcedure.input(z.object({ academicYearId: z.number().int().positive(), termId: z.number().int().positive(), classId: z.number().int().positive(), subjectId: z.number().int().positive(), teacherId: z.number().int().positive(), room: z.string().min(1).max(60), dayOfWeek: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      if (input.endsAt <= input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "The end time must be after the start time." });
      const { db, school } = await getOperatingSchool();
      const sameDay = await db.select().from(timetableSlots).where(and(eq(timetableSlots.schoolId, school.id), eq(timetableSlots.academicYearId, input.academicYearId), eq(timetableSlots.termId, input.termId), eq(timetableSlots.dayOfWeek, input.dayOfWeek)));
      const conflict = sameDay.find(slot => hasTimetableConflict(input, slot));
      if (conflict) throw new TRPCError({ code: "CONFLICT", message: "This timetable slot conflicts with an existing teacher, class, or room booking." });
      await db.insert(timetableSlots).values({ schoolId: school.id, ...input });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "timetable.slot_created", entityType: "timetableSlot", metadata: input });
      return { success: true };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      return db.select({ id: timetableSlots.id, day: timetableSlots.dayOfWeek, startsAt: timetableSlots.startsAt, endsAt: timetableSlots.endsAt, room: timetableSlots.room, subject: subjects.name, form: schoolClasses.form, stream: schoolClasses.stream, teacherFirstName: teachers.firstName, teacherLastName: teachers.lastName }).from(timetableSlots).innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id)).innerJoin(schoolClasses, eq(timetableSlots.classId, schoolClasses.id)).innerJoin(teachers, eq(timetableSlots.teacherId, teachers.id)).where(eq(timetableSlots.schoolId, school.id)).orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startsAt));
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const { db, school } = await getOperatingSchool();
      if (ctx.user.role === "teacher" || ctx.user.role === "class_teacher") {
        const teacher = await getTeacherForUser(ctx.user.id);
        if (!teacher) return [];
        return db.select({ day: timetableSlots.dayOfWeek, startsAt: timetableSlots.startsAt, endsAt: timetableSlots.endsAt, room: timetableSlots.room, subject: subjects.name, form: schoolClasses.form, stream: schoolClasses.stream }).from(timetableSlots).innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id)).innerJoin(schoolClasses, eq(timetableSlots.classId, schoolClasses.id)).where(eq(timetableSlots.teacherId, teacher.id)).orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startsAt));
      }
      const linked = await getLinkedStudentIds(ctx.user.id, ctx.user.role);
      if (!linked.length) return [];
      const classRows = await db.select({ classId: students.currentClassId }).from(students).where(inArray(students.id, linked));
      const classIds = classRows.map(row => row.classId).filter((id): id is number => id !== null);
      if (!classIds.length) return [];
      return db.select({ day: timetableSlots.dayOfWeek, startsAt: timetableSlots.startsAt, endsAt: timetableSlots.endsAt, room: timetableSlots.room, subject: subjects.name, form: schoolClasses.form, stream: schoolClasses.stream }).from(timetableSlots).innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id)).innerJoin(schoolClasses, eq(timetableSlots.classId, schoolClasses.id)).where(and(eq(timetableSlots.schoolId, school.id), inArray(timetableSlots.classId, classIds))).orderBy(asc(timetableSlots.dayOfWeek), asc(timetableSlots.startsAt));
    }),
  }),

  communication: router({
    announcements: protectedProcedure.query(async ({ ctx }) => announcementFeedForUser(ctx.user.id, ctx.user.role)),
    publishAnnouncement: protectedProcedure.input(z.object({ targetScope: z.enum(["school", "form", "class", "teachers", "parents", "students"]), targetForm: z.enum(["Form 1", "Form 2", "Form 3", "Form 4"]).optional(), targetClassId: z.number().int().positive().optional(), title: z.string().min(3).max(180), body: z.string().min(3).max(5000), expiresAt: z.string().datetime().optional() }).superRefine((value, refinement) => { if (value.targetScope === "form" && !value.targetForm) refinement.addIssue({ code: "custom", path: ["targetForm"], message: "A form target is required." }); if (value.targetScope === "class" && !value.targetClassId) refinement.addIssue({ code: "custom", path: ["targetClassId"], message: "A class target is required." }); })).mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["super_admin", "principal", "deputy_principal"]);
      const { db, school } = await getOperatingSchool();
      await db.insert(announcements).values({ schoolId: school.id, authorUserId: ctx.user.id, ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined });
      const [announcement] = await db.select().from(announcements).where(and(eq(announcements.schoolId, school.id), eq(announcements.title, input.title))).orderBy(desc(announcements.id)).limit(1);
      let recipients: number[] = [];
      if (input.targetScope === "school") recipients = (await db.select({ id: users.id }).from(users).where(eq(users.schoolId, school.id))).map(row => row.id);
      else if (input.targetScope === "teachers") recipients = (await db.select({ userId: teachers.userId }).from(teachers).where(and(eq(teachers.schoolId, school.id), sql`${teachers.userId} is not null`))).map(row => row.userId).filter((id): id is number => id !== null);
      else if (input.targetScope === "parents") recipients = (await db.select({ userId: guardians.userId }).from(guardians).where(and(eq(guardians.schoolId, school.id), sql`${guardians.userId} is not null`))).map(row => row.userId).filter((id): id is number => id !== null);
      else {
        const recipientStudents = await db.select({ userId: students.userId }).from(students).leftJoin(schoolClasses, eq(students.currentClassId, schoolClasses.id)).where(and(eq(students.schoolId, school.id), ...(input.targetScope === "class" && input.targetClassId ? [eq(students.currentClassId, input.targetClassId)] : []), ...(input.targetScope === "form" && input.targetForm ? [eq(schoolClasses.form, input.targetForm)] : []), sql`${students.userId} is not null`));
        recipients = recipientStudents.map(row => row.userId).filter((id): id is number => id !== null);
      }
      if (announcement && recipients.length) await db.insert(notifications).values(recipients.map(userId => ({ userId, announcementId: announcement.id, title: announcement.title, body: announcement.body, link: "/" })));
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "announcement.published", entityType: "announcement", entityId: announcement?.id, metadata: { targetScope: input.targetScope } });
      return announcement;
    }),
    notifications: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(30);
    }),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),
  }),

  search: protectedProcedure.input(z.object({ query: z.string().min(2).max(80) })).query(async ({ ctx, input }) => {
    requireRole(ctx.user, ["super_admin", "principal", "deputy_principal", "teacher", "class_teacher", "bursar"]);
    const { db, school } = await getOperatingSchool();
    const value = `%${input.query.trim()}%`;
    const [studentRows, teacherRows, subjectRows] = await Promise.all([
      db.select({ id: students.id, schoolId: students.schoolId, label: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`, detail: students.admissionNo }).from(students).where(and(eq(students.schoolId, school.id), or(like(students.firstName, value), like(students.lastName, value), like(students.admissionNo, value)))).limit(8),
      db.select({ id: teachers.id, schoolId: teachers.schoolId, label: sql<string>`concat(${teachers.firstName}, ' ', ${teachers.lastName})`, detail: teachers.employeeNo }).from(teachers).where(and(eq(teachers.schoolId, school.id), or(like(teachers.firstName, value), like(teachers.lastName, value), like(teachers.employeeNo, value)))).limit(8),
      db.select({ id: subjects.id, schoolId: subjects.schoolId, label: subjects.name, detail: subjects.code }).from(subjects).where(and(eq(subjects.schoolId, school.id), or(like(subjects.name, value), like(subjects.code, value)))).limit(8),
    ]);
    return {
      students: studentRows.filter(row => row.schoolId === school.id).map(({ schoolId: _schoolId, ...row }) => row),
      teachers: teacherRows.filter(row => row.schoolId === school.id).map(({ schoolId: _schoolId, ...row }) => row),
      subjects: subjectRows.filter(row => row.schoolId === school.id).map(({ schoolId: _schoolId, ...row }) => row),
    };
  }),

  reports: router({
    recordExport: protectedProcedure.input(z.object({ reportType: z.string().min(2).max(100), format: z.enum(["pdf", "excel"]), filters: z.record(z.string(), z.string()).optional() })).mutation(async ({ ctx, input }) => {
      const { db, school } = await getOperatingSchool();
      await db.insert(reportExports).values({ schoolId: school.id, userId: ctx.user.id, reportType: input.reportType, format: input.format, filters: input.filters ?? {} });
      await writeAuditLog({ schoolId: school.id, actorUserId: ctx.user.id, action: "report.exported", entityType: "reportExport", metadata: { reportType: input.reportType, format: input.format } });
      return { success: true };
    }),
  }),

  audit: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional()).query(async ({ ctx, input }) => {
    requireRole(ctx.user, ["super_admin", "principal"]);
    const { db, school } = await getOperatingSchool();
    return db.select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, actorName: sql<string>`coalesce(${sql.raw("users.name")}, 'System')` }).from(auditLogs).leftJoin(sql.raw("users"), sql.raw("auditLogs.actorUserId = users.id")).where(eq(auditLogs.schoolId, school.id)).orderBy(desc(auditLogs.createdAt)).limit(input?.limit ?? 50);
  }),
});
