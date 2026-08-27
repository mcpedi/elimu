import {
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  schoolId: int("schoolId").references(() => schools.id),
  isPlatformAdmin: boolean("isPlatformAdmin").notNull().default(false),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", schoolRoles).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
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
  gradeScale: json("gradeScale").$type<GradeBand[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const academicYears = mysqlTable("academicYears", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  name: varchar("name", { length: 16 }).notNull(),
  startsOn: date("startsOn").notNull(),
  endsOn: date("endsOn").notNull(),
  isActive: boolean("isActive").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("academic_year_school_name_unique").on(table.schoolId, table.name)]);

export const terms = mysqlTable("terms", {
  id: int("id").autoincrement().primaryKey(),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  name: mysqlEnum("name", ["Term 1", "Term 2", "Term 3"]).notNull(),
  startsOn: date("startsOn").notNull(),
  endsOn: date("endsOn").notNull(),
  isActive: boolean("isActive").notNull().default(false),
}, table => [uniqueIndex("term_year_name_unique").on(table.academicYearId, table.name)]);

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("department_school_code_unique").on(table.schoolId, table.code)]);

export const teachers = mysqlTable("teachers", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").references(() => users.id),
  employeeNo: varchar("employeeNo", { length: 40 }).notNull(),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  departmentId: int("departmentId").references(() => departments.id),
  employmentStatus: mysqlEnum("employmentStatus", ["active", "on_leave", "inactive"]).notNull().default("active"),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("teacher_school_employee_no_unique").on(table.schoolId, table.employeeNo),
  uniqueIndex("teacher_user_unique").on(table.userId),
]);

export const schoolClasses = mysqlTable("schoolClasses", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  form: mysqlEnum("form", ["Form 1", "Form 2", "Form 3", "Form 4"]).notNull(),
  stream: varchar("stream", { length: 40 }).notNull(),
  capacity: int("capacity").notNull().default(45),
  classTeacherId: int("classTeacherId").references(() => teachers.id),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("class_school_form_stream_unique").on(table.schoolId, table.form, table.stream)]);

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["compulsory", "optional"]).notNull().default("compulsory"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("subject_school_code_unique").on(table.schoolId, table.code)]);

export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").references(() => users.id),
  admissionNo: varchar("admissionNo", { length: 40 }).notNull().unique(),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  middleName: varchar("middleName", { length: 80 }),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  gender: mysqlEnum("gender", ["female", "male", "other", "undisclosed"]).notNull().default("undisclosed"),
  dateOfBirth: date("dateOfBirth"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  photoKey: varchar("photoKey", { length: 512 }),
  currentClassId: int("currentClassId").references(() => schoolClasses.id),
  status: mysqlEnum("status", ["active", "transferred", "completed", "inactive"]).notNull().default("active"),
  disabledAt: timestamp("disabledAt"),
  disabledReason: varchar("disabledReason", { length: 255 }),
  enrolledOn: date("enrolledOn").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("student_school_name_index").on(table.schoolId, table.lastName, table.firstName),
  uniqueIndex("student_user_unique").on(table.userId),
]);

export const studentCredentials = mysqlTable("studentCredentials", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => students.id),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordMode: mysqlEnum("passwordMode", ["admission_number", "legacy_activation", "custom"]).notNull().default("legacy_activation"),
  activationCodeHash: varchar("activationCodeHash", { length: 255 }),
  activationCodeExpiresAt: timestamp("activationCodeExpiresAt"),
  failedAttempts: int("failedAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("student_credentials_student_unique").on(table.studentId)]);

export type StudentCredential = typeof studentCredentials.$inferSelect;
export type InsertStudentCredential = typeof studentCredentials.$inferInsert;

export const guardians = mysqlTable("guardians", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").references(() => users.id),
  firstName: varchar("firstName", { length: 80 }).notNull(),
  lastName: varchar("lastName", { length: 80 }).notNull(),
  relationship: varchar("relationship", { length: 40 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  nationalId: varchar("nationalId", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("guardian_user_unique").on(table.userId)]);

export const studentGuardians = mysqlTable("studentGuardians", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => students.id),
  guardianId: int("guardianId").notNull().references(() => guardians.id),
  isPrimary: boolean("isPrimary").notNull().default(false),
}, table => [uniqueIndex("student_guardian_unique").on(table.studentId, table.guardianId)]);

export const studentDocuments = mysqlTable("studentDocuments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => students.id),
  uploadedByUserId: int("uploadedByUserId").notNull().references(() => users.id),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 768 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  documentType: varchar("documentType", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("student_documents_student_index").on(table.studentId)]);

export const studentSubjects = mysqlTable("studentSubjects", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => students.id),
  subjectId: int("subjectId").notNull().references(() => subjects.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_subject_unique").on(table.studentId, table.subjectId)]);

export const teacherAssignments = mysqlTable("teacherAssignments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  teacherId: int("teacherId").notNull().references(() => teachers.id),
  subjectId: int("subjectId").notNull().references(() => subjects.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  termId: int("termId").references(() => terms.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("teacher_assignment_unique").on(table.teacherId, table.subjectId, table.classId, table.academicYearId, table.termId)]);

export const teacherAttendance = mysqlTable("teacherAttendance", {
  id: int("id").autoincrement().primaryKey(),
  teacherId: int("teacherId").notNull().references(() => teachers.id),
  attendanceDate: date("attendanceDate").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "on_leave"]).notNull(),
  notes: text("notes"),
  recordedByUserId: int("recordedByUserId").notNull().references(() => users.id),
}, table => [uniqueIndex("teacher_attendance_unique").on(table.teacherId, table.attendanceDate)]);

export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  termId: int("termId").notNull().references(() => terms.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  title: varchar("title", { length: 140 }).notNull(),
  assessmentType: mysqlEnum("assessmentType", ["exam", "test", "assignment"]).notNull(),
  maxMarks: decimal("maxMarks", { precision: 6, scale: 2 }).notNull().default("100"),
  assessmentDate: date("assessmentDate").notNull(),
  isPublished: boolean("isPublished").notNull().default(false),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marks = mysqlTable("marks", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull().references(() => assessments.id),
  studentId: int("studentId").notNull().references(() => students.id),
  subjectId: int("subjectId").notNull().references(() => subjects.id),
  teacherId: int("teacherId").notNull().references(() => teachers.id),
  score: decimal("score", { precision: 6, scale: 2 }).notNull(),
  grade: varchar("grade", { length: 4 }).notNull(),
  gradePoints: int("gradePoints").notNull(),
  comment: text("comment"),
  enteredAt: timestamp("enteredAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("mark_assessment_student_subject_unique").on(table.assessmentId, table.studentId, table.subjectId)]);

export const attendanceRecords = mysqlTable("attendanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  studentId: int("studentId").notNull().references(() => students.id),
  attendanceDate: date("attendanceDate").notNull(),
  status: mysqlEnum("status", ["present", "absent", "late"]).notNull(),
  absenceReason: text("absenceReason"),
  markedByUserId: int("markedByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("attendance_student_date_unique").on(table.studentId, table.attendanceDate),
  index("attendance_class_date_index").on(table.classId, table.attendanceDate),
]);

export const feeStructures = mysqlTable("feeStructures", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  termId: int("termId").notNull().references(() => terms.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  name: varchar("name", { length: 120 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studentFeeAccounts = mysqlTable("studentFeeAccounts", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => students.id),
  feeStructureId: int("feeStructureId").notNull().references(() => feeStructures.id),
  amountDue: decimal("amountDue", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amountPaid", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("dueDate"),
  status: mysqlEnum("status", ["unpaid", "partial", "paid", "overdue"]).notNull().default("unpaid"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("student_fee_account_unique").on(table.studentId, table.feeStructureId)]);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  studentFeeAccountId: int("studentFeeAccountId").notNull().references(() => studentFeeAccounts.id),
  studentId: int("studentId").notNull().references(() => students.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["mpesa", "bank", "cash", "other"]).notNull(),
  reference: varchar("reference", { length: 100 }),
  payerName: varchar("payerName", { length: 160 }),
  receiptNo: varchar("receiptNo", { length: 50 }).notNull().unique(),
  paymentDate: date("paymentDate").notNull(),
  receivedByUserId: int("receivedByUserId").notNull().references(() => users.id),
  providerReference: varchar("providerReference", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("payment_student_date_index").on(table.studentId, table.paymentDate)]);

export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("paymentId").notNull().references(() => payments.id).unique(),
  receiptNo: varchar("receiptNo", { length: 50 }).notNull().unique(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  issuedByUserId: int("issuedByUserId").notNull().references(() => users.id),
});

export const timetableSlots = mysqlTable("timetableSlots", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  termId: int("termId").notNull().references(() => terms.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  subjectId: int("subjectId").notNull().references(() => subjects.id),
  teacherId: int("teacherId").notNull().references(() => teachers.id),
  room: varchar("room", { length: 60 }).notNull(),
  dayOfWeek: mysqlEnum("dayOfWeek", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).notNull(),
  startsAt: varchar("startsAt", { length: 5 }).notNull(),
  endsAt: varchar("endsAt", { length: 5 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("timetable_class_day_index").on(table.classId, table.dayOfWeek)]);

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  subjectId: int("subjectId").notNull().references(() => subjects.id),
  teacherId: int("teacherId").notNull().references(() => teachers.id),
  title: varchar("title", { length: 180 }).notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("dueAt").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assignmentCompletions = mysqlTable("assignmentCompletions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull().references(() => assignments.id),
  studentId: int("studentId").notNull().references(() => students.id),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, table => [uniqueIndex("assignment_completion_unique").on(table.assignmentId, table.studentId), index("assignment_completion_student_index").on(table.studentId, table.completedAt)]);

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  authorUserId: int("authorUserId").notNull().references(() => users.id),
  targetScope: mysqlEnum("targetScope", ["school", "form", "class", "teachers", "parents", "students"]).notNull(),
  targetForm: mysqlEnum("targetForm", ["Form 1", "Form 2", "Form 3", "Form 4"]),
  targetClassId: int("targetClassId").references(() => schoolClasses.id),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  attachmentKey: varchar("attachmentKey", { length: 512 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  isPinned: boolean("isPinned").notNull().default(false),
});

export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  category: mysqlEnum("category", ["term", "exam", "event", "parent_meeting", "teacher_meeting", "holiday", "deadline"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt"),
  location: varchar("location", { length: 180 }),
  description: text("description"),
  targetScope: mysqlEnum("targetScope", ["school", "form", "class", "teachers", "parents", "students"]).notNull().default("school"),
  targetForm: mysqlEnum("targetForm", ["Form 1", "Form 2", "Form 3", "Form 4"]),
  targetClassId: int("targetClassId").references(() => schoolClasses.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("calendar_event_school_start_index").on(table.schoolId, table.startsAt)]);

export const studentIdCards = mysqlTable("studentIdCards", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  studentId: int("studentId").notNull().references(() => students.id),
  academicYearId: int("academicYearId").references(() => academicYears.id),
  verificationToken: varchar("verificationToken", { length: 64 }).notNull().unique(),
  generatedByUserId: int("generatedByUserId").notNull().references(() => users.id),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
}, table => [uniqueIndex("student_id_card_school_student_year_unique").on(table.schoolId, table.studentId, table.academicYearId)]);

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  senderUserId: int("senderUserId").notNull().references(() => users.id),
  recipientUserId: int("recipientUserId").notNull().references(() => users.id),
  subject: varchar("subject", { length: 180 }).notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
}, table => [index("message_recipient_sent_index").on(table.recipientUserId, table.sentAt), index("message_sender_sent_index").on(table.senderUserId, table.sentAt)]);

export const recentViews = mysqlTable("recentViews", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").notNull().references(() => users.id),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: varchar("entityId", { length: 80 }).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("recent_view_user_entity_unique").on(table.userId, table.entityType, table.entityId), index("recent_view_user_viewed_index").on(table.userId, table.viewedAt)]);

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  announcementId: int("announcementId").references(() => announcements.id),
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

export const reportCards = mysqlTable("reportCards", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  studentId: int("studentId").notNull().references(() => students.id),
  academicYearId: int("academicYearId").notNull().references(() => academicYears.id),
  termId: int("termId").notNull().references(() => terms.id),
  classId: int("classId").notNull().references(() => schoolClasses.id),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  updatedByUserId: int("updatedByUserId").notNull().references(() => users.id),
  title: varchar("title", { length: 140 }).notNull(),
  resultSnapshot: json("resultSnapshot").$type<ReportCardResult[]>().notNull(),
  totalMarks: decimal("totalMarks", { precision: 10, scale: 2 }).notNull(),
  averagePercentage: decimal("averagePercentage", { precision: 6, scale: 2 }).notNull(),
  meanPoints: decimal("meanPoints", { precision: 6, scale: 2 }).notNull(),
  overallGrade: varchar("overallGrade", { length: 4 }).notNull(),
  teacherComment: text("teacherComment"),
  publishedAt: timestamp("publishedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("report_card_student_term_unique").on(table.studentId, table.termId),
  index("report_card_school_published_index").on(table.schoolId, table.publishedAt),
]);

export type ReportCard = typeof reportCards.$inferSelect;
export type InsertReportCard = typeof reportCards.$inferInsert;

export const reportExports = mysqlTable("reportExports", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").notNull().references(() => users.id),
  reportType: varchar("reportType", { length: 100 }).notNull(),
  format: mysqlEnum("format", ["pdf", "excel"]).notNull(),
  filters: json("filters").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("report_export_school_created_index").on(table.schoolId, table.createdAt)]);

export const aiConversations = mysqlTable("aiConversations", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 160 }).notNull().default("New conversation"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("ai_conversation_user_recent_index").on(table.userId, table.lastMessageAt), index("ai_conversation_school_user_index").on(table.schoolId, table.userId)]);
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;
export const aiConversationMessages = mysqlTable("aiConversationMessages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => aiConversations.id),
  schoolId: int("schoolId").notNull().references(() => schools.id),
  userId: int("userId").notNull().references(() => users.id),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ai_message_conversation_created_index").on(table.conversationId, table.createdAt), index("ai_message_school_user_index").on(table.schoolId, table.userId)]);
export type AiConversationMessage = typeof aiConversationMessages.$inferSelect;
export type InsertAiConversationMessage = typeof aiConversationMessages.$inferInsert;
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  schoolId: int("schoolId").references(() => schools.id),
  actorUserId: int("actorUserId").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_school_created_index").on(table.schoolId, table.createdAt)]);
