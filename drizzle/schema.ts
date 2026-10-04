import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const schoolRoles = [
  "user",
  "super_admin",
  "principal",
  "deputy_principal",
  "teacher",
  "class_teacher",
  "bursar",
  "parent",
  "student",
] as const;

export type SchoolRole = (typeof schoolRoles)[number];

export type GradeBand = {
  min: number;
  max: number;
  grade: string;
  points: number;
  remark?: string;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  schoolId: integer("schoolId").references(() => schools.id),
  isPlatformAdmin: boolean("isPlatformAdmin").notNull().default(false),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").$type<SchoolRole>().default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  county: varchar("county", { length: 80 }),
  address: text("address"),
  logoKey: varchar("logoKey", { length: 512 }),
  motto: varchar("motto", { length: 180 }),
  website: varchar("website", { length: 255 }),
  primaryColor: varchar("primaryColor", { length: 16 }),
  accentColor: varchar("accentColor", { length: 16 }),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  admissionPrefix: varchar("admissionPrefix", { length: 16 }).notNull().default("ADM"),
  gradeScale: jsonb("gradeScale").$type<GradeBand[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const academicYears = pgTable("academicYears", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  name: varchar("name", { length: 16 }).notNull(),
  startsOn: date("startsOn", { mode: "date" }).notNull(),
  endsOn: date("endsOn", { mode: "date" }).notNull(),
  isActive: boolean("isActive").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("academic_year_school_name_unique").on(table.schoolId, table.name)]);

export const terms = pgTable("terms", {
  id: serial("id").primaryKey(),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  name: text("name").$type<"Term 1" | "Term 2" | "Term 3">().notNull(),
  startsOn: date("startsOn", { mode: "date" }).notNull(),
  endsOn: date("endsOn", { mode: "date" }).notNull(),
  isActive: boolean("isActive").notNull().default(false),
}, table => [uniqueIndex("term_year_name_unique").on(table.academicYearId, table.name)]);

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("department_school_code_unique").on(table.schoolId, table.code)]);

export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").references(() => users.id),
  employeeNo: varchar("employeeNo", { length: 40 }).notNull(),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  departmentId: integer("departmentId").references(() => departments.id),
  employmentStatus: text("employmentStatus").$type<"active" | "on_leave" | "inactive">().notNull().default("active"),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("teacher_school_employee_no_unique").on(table.schoolId, table.employeeNo),
  uniqueIndex("teacher_user_unique").on(table.userId),
]);

export const schoolClasses = pgTable("schoolClasses", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  form: text("form").$type<"Form 1" | "Form 2" | "Form 3" | "Form 4">().notNull(),
  stream: varchar("stream", { length: 40 }).notNull(),
  capacity: integer("capacity").notNull().default(45),
  classTeacherId: integer("classTeacherId").references(() => teachers.id),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("class_school_form_stream_unique").on(table.schoolId, table.form, table.stream)]);

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  category: text("category").$type<"compulsory" | "optional">().notNull().default("compulsory"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("subject_school_code_unique").on(table.schoolId, table.code)]);

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").references(() => users.id),
  admissionNo: varchar("admissionNo", { length: 40 }).notNull().unique(),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  middleName: varchar("middleName", { length: 80 }),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  gender: text("gender").$type<"female" | "male" | "other" | "undisclosed">().notNull().default("undisclosed"),
  dateOfBirth: date("dateOfBirth", { mode: "date" }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  photoKey: varchar("photoKey", { length: 512 }),
  currentClassId: integer("currentClassId").references(() => schoolClasses.id),
  status: text("status").$type<"active" | "transferred" | "completed" | "inactive">().notNull().default("active"),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
  enrolledOn: date("enrolledOn", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  index("student_school_name_index").on(table.schoolId, table.lastName, table.firstName),
  uniqueIndex("student_user_unique").on(table.userId),
]);

export const studentCredentials = pgTable("studentCredentials", {
  id: serial("id").primaryKey(),
  studentId: integer("studentId").notNull().references(() => students.id),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordMode: text("passwordMode").$type<"admission_number" | "legacy_activation" | "custom">().notNull().default("legacy_activation"),
  activationCodeHash: varchar("activationCodeHash", { length: 255 }),
  activationCodeExpiresAt: timestamp("activationCodeExpiresAt"),
  failedAttempts: integer("failedAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_credentials_student_unique").on(table.studentId)]);

export type StudentCredential = typeof studentCredentials.$inferSelect;
export type InsertStudentCredential = typeof studentCredentials.$inferInsert;

export const guardians = pgTable("guardians", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").references(() => users.id),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  relationship: varchar("relationship", { length: 40 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  nationalId: varchar("nationalId", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("guardian_user_unique").on(table.userId)]);

export const studentGuardians = pgTable("studentGuardians", {
  id: serial("id").primaryKey(),
  studentId: integer("studentId").notNull().references(() => students.id),
  guardianId: integer("guardianId").notNull().references(() => guardians.id),
  isPrimary: boolean("isPrimary").notNull().default(false),
}, table => [uniqueIndex("student_guardian_unique").on(table.studentId, table.guardianId)]);

export const studentDocuments = pgTable("studentDocuments", {
  id: serial("id").primaryKey(),
  studentId: integer("studentId").notNull().references(() => students.id),
  uploadedByUserId: integer("uploadedByUserId").notNull().references(() => users.id),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 768 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  documentType: varchar("documentType", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("student_documents_student_index").on(table.studentId)]);

export const studentSubjects = pgTable("studentSubjects", {
  id: serial("id").primaryKey(),
  studentId: integer("studentId").notNull().references(() => students.id),
  subjectId: integer("subjectId").notNull().references(() => subjects.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_subject_unique").on(table.studentId, table.subjectId)]);

export const teacherAssignments = pgTable("teacherAssignments", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  teacherId: integer("teacherId").notNull().references(() => teachers.id),
  subjectId: integer("subjectId").notNull().references(() => subjects.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  termId: integer("termId").references(() => terms.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("teacher_assignment_unique").on(table.teacherId, table.subjectId, table.classId, table.academicYearId, table.termId)]);

export const teacherAttendance = pgTable("teacherAttendance", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacherId").notNull().references(() => teachers.id),
  attendanceDate: date("attendanceDate", { mode: "date" }).notNull(),
  status: text("status").$type<"present" | "absent" | "late" | "on_leave">().notNull(),
  notes: text("notes"),
  recordedByUserId: integer("recordedByUserId").notNull().references(() => users.id),
}, table => [uniqueIndex("teacher_attendance_unique").on(table.teacherId, table.attendanceDate)]);

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  termId: integer("termId").notNull().references(() => terms.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  title: varchar("title", { length: 140 }).notNull(),
  assessmentType: text("assessmentType").$type<"exam" | "test" | "assignment">().notNull(),
  maxMarks: numeric("maxMarks", { precision: 6, scale: 2 }).notNull().default("100"),
  assessmentDate: date("assessmentDate", { mode: "date" }).notNull(),
  isPublished: boolean("isPublished").notNull().default(false),
  createdByUserId: integer("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marks = pgTable("marks", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessmentId").notNull().references(() => assessments.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  subjectId: integer("subjectId").notNull().references(() => subjects.id),
  teacherId: integer("teacherId").notNull().references(() => teachers.id),
  score: numeric("score", { precision: 6, scale: 2 }).notNull(),
  grade: varchar("grade", { length: 4 }).notNull(),
  gradePoints: integer("gradePoints").notNull(),
  comment: text("comment"),
  enteredAt: timestamp("enteredAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [uniqueIndex("mark_assessment_student_subject_unique").on(table.assessmentId, table.studentId, table.subjectId)]);

export const attendanceRecords = pgTable("attendanceRecords", {
  id: serial("id").primaryKey(),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  attendanceDate: date("attendanceDate", { mode: "date" }).notNull(),
  status: text("status").$type<"present" | "absent" | "late">().notNull(),
  absenceReason: text("absenceReason"),
  markedByUserId: integer("markedByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("attendance_student_date_unique").on(table.studentId, table.attendanceDate),
  index("attendance_class_date_index").on(table.classId, table.attendanceDate),
]);

export const feeStructures = pgTable("feeStructures", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  termId: integer("termId").notNull().references(() => terms.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  name: varchar("name", { length: 120 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate", { mode: "date" }),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studentFeeAccounts = pgTable("studentFeeAccounts", {
  id: serial("id").primaryKey(),
  studentId: integer("studentId").notNull().references(() => students.id),
  feeStructureId: integer("feeStructureId").notNull().references(() => feeStructures.id),
  amountDue: numeric("amountDue", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amountPaid", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("dueDate", { mode: "date" }),
  status: text("status").$type<"unpaid" | "partial" | "paid" | "overdue">().notNull().default("unpaid"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_fee_account_unique").on(table.studentId, table.feeStructureId)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  studentFeeAccountId: integer("studentFeeAccountId").notNull().references(() => studentFeeAccounts.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").$type<"mpesa" | "bank" | "cash" | "other">().notNull(),
  reference: varchar("reference", { length: 100 }),
  payerName: varchar("payerName", { length: 160 }),
  receiptNo: varchar("receiptNo", { length: 50 }).notNull().unique(),
  paymentDate: date("paymentDate", { mode: "date" }).notNull(),
  receivedByUserId: integer("receivedByUserId").notNull().references(() => users.id),
  providerReference: varchar("providerReference", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("payment_student_date_index").on(table.studentId, table.paymentDate)]);

export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  paymentId: integer("paymentId").notNull().references(() => payments.id).unique(),
  receiptNo: varchar("receiptNo", { length: 50 }).notNull().unique(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  issuedByUserId: integer("issuedByUserId").notNull().references(() => users.id),
});

export const timetableSlots = pgTable("timetableSlots", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  termId: integer("termId").notNull().references(() => terms.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  subjectId: integer("subjectId").notNull().references(() => subjects.id),
  teacherId: integer("teacherId").notNull().references(() => teachers.id),
  room: varchar("room", { length: 60 }).notNull(),
  dayOfWeek: text("dayOfWeek").$type<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday">().notNull(),
  startsAt: varchar("startsAt", { length: 5 }).notNull(),
  endsAt: varchar("endsAt", { length: 5 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("timetable_class_day_index").on(table.classId, table.dayOfWeek)]);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  subjectId: integer("subjectId").notNull().references(() => subjects.id),
  teacherId: integer("teacherId").notNull().references(() => teachers.id),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("dueAt").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const assignmentCompletions = pgTable("assignmentCompletions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull().references(() => assignments.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, table => [uniqueIndex("assignment_completion_unique").on(table.assignmentId, table.studentId), index("assignment_completion_student_index").on(table.studentId, table.completedAt)]);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  authorUserId: integer("authorUserId").notNull().references(() => users.id),
  targetScope: text("targetScope").$type<"school" | "form" | "class" | "teachers" | "parents" | "students">().notNull(),
  targetForm: text("targetForm").$type<"Form 1" | "Form 2" | "Form 3" | "Form 4">(),
  targetClassId: integer("targetClassId").references(() => schoolClasses.id),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  isPinned: boolean("isPinned").notNull().default(false),
});

export const calendarEvents = pgTable("calendarEvents", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  createdByUserId: integer("createdByUserId").notNull().references(() => users.id),
  category: text("category").$type<"term" | "exam" | "event" | "parent_meeting" | "teacher_meeting" | "holiday" | "deadline">().notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  location: varchar("location", { length: 180 }),
  description: text("description"),
  targetScope: text("targetScope").$type<"school" | "form" | "class" | "teachers" | "parents" | "students">().notNull().default("school"),
  targetForm: text("targetForm").$type<"Form 1" | "Form 2" | "Form 3" | "Form 4">(),
  targetClassId: integer("targetClassId").references(() => schoolClasses.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [index("calendar_event_school_start_index").on(table.schoolId, table.startsAt)]);

export const studentIdCards = pgTable("studentIdCards", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  academicYearId: integer("academicYearId").references(() => academicYears.id),
  verificationToken: varchar("verificationToken", { length: 64 }).notNull().unique(),
  generatedByUserId: integer("generatedByUserId").notNull().references(() => users.id),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_id_card_school_student_year_unique").on(table.schoolId, table.studentId, table.academicYearId)]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  senderUserId: integer("senderUserId").notNull().references(() => users.id),
  recipientUserId: integer("recipientUserId").notNull().references(() => users.id),
  subject: varchar("subject", { length: 180 }).notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
}, table => [index("message_recipient_sent_index").on(table.recipientUserId, table.sentAt), index("message_sender_sent_index").on(table.senderUserId, table.sentAt)]);

export const recentViews = pgTable("recentViews", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").notNull().references(() => users.id),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: varchar("entityId", { length: 80 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, table => [uniqueIndex("recent_view_user_entity_unique").on(table.userId, table.entityType, table.entityId), index("recent_view_user_viewed_index").on(table.userId, table.viewedAt)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  announcementId: integer("announcementId").references(() => announcements.id),
  category: text("category").$type<"finance" | "academics" | "announcements" | "attendance" | "account" | "general">().notNull().default("general"),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  link: varchar("link", { length: 255 }),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReportCardResult = {
  subjectId: number;
  subject: string;
  subjectCode: string;
  score: number;
  maxMarks: number;
  grade: string;
  gradePoints: number;
  assessment: string;
  assessmentDate: string;
  comment?: string | null;
};

export const reportCards = pgTable("reportCards", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  studentId: integer("studentId").notNull().references(() => students.id),
  academicYearId: integer("academicYearId").notNull().references(() => academicYears.id),
  termId: integer("termId").notNull().references(() => terms.id),
  classId: integer("classId").notNull().references(() => schoolClasses.id),
  createdByUserId: integer("createdByUserId").notNull().references(() => users.id),
  updatedByUserId: integer("updatedByUserId").notNull().references(() => users.id),
  title: varchar("title", { length: 140 }).notNull(),
  resultSnapshot: jsonb("resultSnapshot").$type<ReportCardResult[]>().notNull(),
  totalMarks: numeric("totalMarks", { precision: 10, scale: 2 }).notNull(),
  averagePercentage: numeric("averagePercentage", { precision: 6, scale: 2 }).notNull(),
  meanPoints: numeric("meanPoints", { precision: 6, scale: 2 }).notNull(),
  overallGrade: varchar("overallGrade", { length: 4 }).notNull(),
  teacherComment: text("teacherComment"),
  publishedAt: timestamp("publishedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("report_card_student_term_unique").on(table.studentId, table.termId),
  index("report_card_school_published_index").on(table.schoolId, table.publishedAt),
]);

export type ReportCard = typeof reportCards.$inferSelect;
export type InsertReportCard = typeof reportCards.$inferInsert;

export const reportExports = pgTable("reportExports", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").notNull().references(() => users.id),
  reportType: varchar("reportType", { length: 100 }).notNull(),
  format: text("format").$type<"pdf" | "excel">().notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_export_school_created_index").on(table.schoolId, table.createdAt)]);

export const aiConversations = pgTable("aiConversations", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 160 }).notNull().default("New conversation"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [index("ai_conversation_user_recent_index").on(table.userId, table.lastMessageAt), index("ai_conversation_school_user_index").on(table.schoolId, table.userId)]);
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;
export const aiConversationMessages = pgTable("aiConversationMessages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull().references(() => aiConversations.id),
  schoolId: integer("schoolId").notNull().references(() => schools.id),
  userId: integer("userId").notNull().references(() => users.id),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ai_message_conversation_created_index").on(table.conversationId, table.createdAt), index("ai_message_school_user_index").on(table.schoolId, table.userId)]);
export type AiConversationMessage = typeof aiConversationMessages.$inferSelect;
export type InsertAiConversationMessage = typeof aiConversationMessages.$inferInsert;
export const auditLogs = pgTable("auditLogs", {
  id: serial("id").primaryKey(),
  schoolId: integer("schoolId").references(() => schools.id),
  actorUserId: integer("actorUserId").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_school_created_index").on(table.schoolId, table.createdAt)]);


export const localAuthCredentials = pgTable("localAuthCredentials", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  username: varchar("username", { length: 160 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  setupCodeHash: varchar("setupCodeHash", { length: 255 }),
  setupCodeExpiresAt: timestamp("setupCodeExpiresAt"),
  failedAttempts: integer("failedAttempts").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("local_auth_credentials_user_unique").on(table.userId),
  uniqueIndex("local_auth_credentials_username_unique").on(table.username),
]);
export type LocalAuthCredential = typeof localAuthCredentials.$inferSelect;
export type InsertLocalAuthCredential = typeof localAuthCredentials.$inferInsert;

export const localAuthSessions = pgTable("localAuthSessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("local_auth_session_token_unique").on(table.tokenHash),
  index("local_auth_session_user_index").on(table.userId),
  index("local_auth_session_expiry_index").on(table.expiresAt),
]);
export type LocalAuthSession = typeof localAuthSessions.$inferSelect;
export type InsertLocalAuthSession = typeof localAuthSessions.$inferInsert;
