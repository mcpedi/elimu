CREATE TABLE `academicYears` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(16) NOT NULL,
	`startsOn` date NOT NULL,
	`endsOn` date NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academicYears_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_year_school_name_unique` UNIQUE(`schoolId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`targetScope` enum('school','form','class','teachers','parents','students') NOT NULL,
	`targetForm` enum('Form 1','Form 2','Form 3','Form 4'),
	`targetClassId` int,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`termId` int NOT NULL,
	`classId` int NOT NULL,
	`title` varchar(140) NOT NULL,
	`assessmentType` enum('exam','test','assignment') NOT NULL,
	`maxMarks` decimal(6,2) NOT NULL DEFAULT '100',
	`assessmentDate` date NOT NULL,
	`isPublished` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`classId` int NOT NULL,
	`subjectId` int NOT NULL,
	`teacherId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`instructions` text,
	`dueAt` timestamp NOT NULL,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`studentId` int NOT NULL,
	`attendanceDate` date NOT NULL,
	`status` enum('present','absent','late') NOT NULL,
	`absenceReason` text,
	`markedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendanceRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_student_date_unique` UNIQUE(`studentId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int,
	`actorUserId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `department_school_code_unique` UNIQUE(`schoolId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `feeStructures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`termId` int NOT NULL,
	`classId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`dueDate` date,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feeStructures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int,
	`firstName` varchar(80) NOT NULL,
	`lastName` varchar(80) NOT NULL,
	`relationship` varchar(40) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`nationalId` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guardians_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardian_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `marks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`subjectId` int NOT NULL,
	`teacherId` int NOT NULL,
	`score` decimal(6,2) NOT NULL,
	`grade` varchar(4) NOT NULL,
	`gradePoints` int NOT NULL,
	`comment` text,
	`enteredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marks_id` PRIMARY KEY(`id`),
	CONSTRAINT `mark_assessment_student_subject_unique` UNIQUE(`assessmentId`,`studentId`,`subjectId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`announcementId` int,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`link` varchar(255),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentFeeAccountId` int NOT NULL,
	`studentId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`method` enum('mpesa','bank','cash','other') NOT NULL,
	`reference` varchar(100),
	`payerName` varchar(160),
	`receiptNo` varchar(50) NOT NULL,
	`paymentDate` date NOT NULL,
	`receivedByUserId` int NOT NULL,
	`providerReference` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_receiptNo_unique` UNIQUE(`receiptNo`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` int NOT NULL,
	`receiptNo` varchar(50) NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`issuedByUserId` int NOT NULL,
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_paymentId_unique` UNIQUE(`paymentId`),
	CONSTRAINT `receipts_receiptNo_unique` UNIQUE(`receiptNo`)
);
--> statement-breakpoint
CREATE TABLE `schoolClasses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`form` enum('Form 1','Form 2','Form 3','Form 4') NOT NULL,
	`stream` varchar(40) NOT NULL,
	`capacity` int NOT NULL DEFAULT 45,
	`classTeacherId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schoolClasses_id` PRIMARY KEY(`id`),
	CONSTRAINT `class_school_form_stream_unique` UNIQUE(`schoolId`,`form`,`stream`)
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`code` varchar(24) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`county` varchar(80),
	`address` text,
	`logoKey` varchar(512),
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`admissionPrefix` varchar(16) NOT NULL DEFAULT 'ADM',
	`gradeScale` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schools_id` PRIMARY KEY(`id`),
	CONSTRAINT `schools_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `studentDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(768) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`documentType` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studentDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentFeeAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`feeStructureId` int NOT NULL,
	`amountDue` decimal(12,2) NOT NULL,
	`amountPaid` decimal(12,2) NOT NULL DEFAULT '0',
	`dueDate` date,
	`status` enum('unpaid','partial','paid','overdue') NOT NULL DEFAULT 'unpaid',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentFeeAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_fee_account_unique` UNIQUE(`studentId`,`feeStructureId`)
);
--> statement-breakpoint
CREATE TABLE `studentGuardians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`guardianId` int NOT NULL,
	`isPrimary` boolean NOT NULL DEFAULT false,
	CONSTRAINT `studentGuardians_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_guardian_unique` UNIQUE(`studentId`,`guardianId`)
);
--> statement-breakpoint
CREATE TABLE `studentSubjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`subjectId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studentSubjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_subject_unique` UNIQUE(`studentId`,`subjectId`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int,
	`admissionNo` varchar(40) NOT NULL,
	`firstName` varchar(80) NOT NULL,
	`middleName` varchar(80),
	`lastName` varchar(80) NOT NULL,
	`gender` enum('female','male','other','undisclosed') NOT NULL DEFAULT 'undisclosed',
	`dateOfBirth` date,
	`phone` varchar(20),
	`email` varchar(320),
	`currentClassId` int,
	`status` enum('active','transferred','completed','inactive') NOT NULL DEFAULT 'active',
	`enrolledOn` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_admissionNo_unique` UNIQUE(`admissionNo`),
	CONSTRAINT `student_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`category` enum('compulsory','optional') NOT NULL DEFAULT 'compulsory',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subject_school_code_unique` UNIQUE(`schoolId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `teacherAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`teacherId` int NOT NULL,
	`subjectId` int NOT NULL,
	`classId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`termId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacherAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_assignment_unique` UNIQUE(`teacherId`,`subjectId`,`classId`,`academicYearId`,`termId`)
);
--> statement-breakpoint
CREATE TABLE `teacherAttendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`attendanceDate` date NOT NULL,
	`status` enum('present','absent','late','on_leave') NOT NULL,
	`notes` text,
	`recordedByUserId` int NOT NULL,
	CONSTRAINT `teacherAttendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_attendance_unique` UNIQUE(`teacherId`,`attendanceDate`)
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int,
	`employeeNo` varchar(40) NOT NULL,
	`firstName` varchar(80) NOT NULL,
	`lastName` varchar(80) NOT NULL,
	`phone` varchar(20),
	`email` varchar(320),
	`departmentId` int,
	`employmentStatus` enum('active','on_leave','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachers_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacher_school_employee_no_unique` UNIQUE(`schoolId`,`employeeNo`),
	CONSTRAINT `teacher_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`academicYearId` int NOT NULL,
	`name` enum('Term 1','Term 2','Term 3') NOT NULL,
	`startsOn` date NOT NULL,
	`endsOn` date NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	CONSTRAINT `terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `term_year_name_unique` UNIQUE(`academicYearId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `timetableSlots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`termId` int NOT NULL,
	`classId` int NOT NULL,
	`subjectId` int NOT NULL,
	`teacherId` int NOT NULL,
	`room` varchar(60) NOT NULL,
	`dayOfWeek` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
	`startsAt` varchar(5) NOT NULL,
	`endsAt` varchar(5) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timetableSlots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','super_admin','principal','deputy_principal','teacher','class_teacher','bursar','parent','student') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `academicYears` ADD CONSTRAINT `academicYears_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_targetClassId_schoolClasses_id_fk` FOREIGN KEY (`targetClassId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_termId_terms_id_fk` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_teacherId_teachers_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD CONSTRAINT `attendanceRecords_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD CONSTRAINT `attendanceRecords_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendanceRecords` ADD CONSTRAINT `attendanceRecords_markedByUserId_users_id_fk` FOREIGN KEY (`markedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feeStructures` ADD CONSTRAINT `feeStructures_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feeStructures` ADD CONSTRAINT `feeStructures_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feeStructures` ADD CONSTRAINT `feeStructures_termId_terms_id_fk` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feeStructures` ADD CONSTRAINT `feeStructures_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guardians` ADD CONSTRAINT `guardians_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marks` ADD CONSTRAINT `marks_assessmentId_assessments_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marks` ADD CONSTRAINT `marks_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marks` ADD CONSTRAINT `marks_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marks` ADD CONSTRAINT `marks_teacherId_teachers_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_announcementId_announcements_id_fk` FOREIGN KEY (`announcementId`) REFERENCES `announcements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_studentFeeAccountId_studentFeeAccounts_id_fk` FOREIGN KEY (`studentFeeAccountId`) REFERENCES `studentFeeAccounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_receivedByUserId_users_id_fk` FOREIGN KEY (`receivedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_paymentId_payments_id_fk` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_issuedByUserId_users_id_fk` FOREIGN KEY (`issuedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schoolClasses` ADD CONSTRAINT `schoolClasses_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schoolClasses` ADD CONSTRAINT `schoolClasses_classTeacherId_teachers_id_fk` FOREIGN KEY (`classTeacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentDocuments` ADD CONSTRAINT `studentDocuments_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentDocuments` ADD CONSTRAINT `studentDocuments_uploadedByUserId_users_id_fk` FOREIGN KEY (`uploadedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentFeeAccounts` ADD CONSTRAINT `studentFeeAccounts_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentFeeAccounts` ADD CONSTRAINT `studentFeeAccounts_feeStructureId_feeStructures_id_fk` FOREIGN KEY (`feeStructureId`) REFERENCES `feeStructures`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentGuardians` ADD CONSTRAINT `studentGuardians_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentGuardians` ADD CONSTRAINT `studentGuardians_guardianId_guardians_id_fk` FOREIGN KEY (`guardianId`) REFERENCES `guardians`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentSubjects` ADD CONSTRAINT `studentSubjects_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentSubjects` ADD CONSTRAINT `studentSubjects_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_currentClassId_schoolClasses_id_fk` FOREIGN KEY (`currentClassId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_teacherId_teachers_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAssignments` ADD CONSTRAINT `teacherAssignments_termId_terms_id_fk` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAttendance` ADD CONSTRAINT `teacherAttendance_teacherId_teachers_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacherAttendance` ADD CONSTRAINT `teacherAttendance_recordedByUserId_users_id_fk` FOREIGN KEY (`recordedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `terms` ADD CONSTRAINT `terms_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_termId_terms_id_fk` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_subjectId_subjects_id_fk` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timetableSlots` ADD CONSTRAINT `timetableSlots_teacherId_teachers_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attendance_class_date_index` ON `attendanceRecords` (`classId`,`attendanceDate`);--> statement-breakpoint
CREATE INDEX `audit_school_created_index` ON `auditLogs` (`schoolId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payment_student_date_index` ON `payments` (`studentId`,`paymentDate`);--> statement-breakpoint
CREATE INDEX `student_documents_student_index` ON `studentDocuments` (`studentId`);--> statement-breakpoint
CREATE INDEX `student_school_name_index` ON `students` (`schoolId`,`lastName`,`firstName`);--> statement-breakpoint
CREATE INDEX `timetable_class_day_index` ON `timetableSlots` (`classId`,`dayOfWeek`);