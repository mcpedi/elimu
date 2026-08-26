CREATE TABLE `assignmentCompletions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignmentCompletions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignment_completion_unique` UNIQUE(`assignmentId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `calendarEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`category` enum('term','exam','event','parent_meeting','teacher_meeting','holiday','deadline') NOT NULL,
	`title` varchar(180) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`location` varchar(180),
	`description` text,
	`targetScope` enum('school','form','class','teachers','parents','students') NOT NULL DEFAULT 'school',
	`targetForm` enum('Form 1','Form 2','Form 3','Form 4'),
	`targetClassId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendarEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`senderUserId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`subject` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recentViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` varchar(80) NOT NULL,
	`label` varchar(180) NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recentViews_id` PRIMARY KEY(`id`),
	CONSTRAINT `recent_view_user_entity_unique` UNIQUE(`userId`,`entityType`,`entityId`)
);
--> statement-breakpoint
CREATE TABLE `studentIdCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentId` int NOT NULL,
	`academicYearId` int,
	`verificationToken` varchar(64) NOT NULL,
	`generatedByUserId` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studentIdCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `studentIdCards_verificationToken_unique` UNIQUE(`verificationToken`),
	CONSTRAINT `student_id_card_school_student_year_unique` UNIQUE(`schoolId`,`studentId`,`academicYearId`)
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `attachmentKey` varchar(512);--> statement-breakpoint
ALTER TABLE `announcements` ADD `attachmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `announcements` ADD `isPinned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `assignments` ADD `attachmentKey` varchar(512);--> statement-breakpoint
ALTER TABLE `assignments` ADD `attachmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `assignments` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `schools` ADD `motto` varchar(180);--> statement-breakpoint
ALTER TABLE `schools` ADD `website` varchar(255);--> statement-breakpoint
ALTER TABLE `schools` ADD `primaryColor` varchar(16);--> statement-breakpoint
ALTER TABLE `schools` ADD `accentColor` varchar(16);--> statement-breakpoint
ALTER TABLE `students` ADD `photoKey` varchar(512);--> statement-breakpoint
ALTER TABLE `assignmentCompletions` ADD CONSTRAINT `assignmentCompletions_assignmentId_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignmentCompletions` ADD CONSTRAINT `assignmentCompletions_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD CONSTRAINT `calendarEvents_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD CONSTRAINT `calendarEvents_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD CONSTRAINT `calendarEvents_targetClassId_schoolClasses_id_fk` FOREIGN KEY (`targetClassId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recentViews` ADD CONSTRAINT `recentViews_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recentViews` ADD CONSTRAINT `recentViews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentIdCards` ADD CONSTRAINT `studentIdCards_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentIdCards` ADD CONSTRAINT `studentIdCards_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentIdCards` ADD CONSTRAINT `studentIdCards_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentIdCards` ADD CONSTRAINT `studentIdCards_generatedByUserId_users_id_fk` FOREIGN KEY (`generatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assignment_completion_student_index` ON `assignmentCompletions` (`studentId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `calendar_event_school_start_index` ON `calendarEvents` (`schoolId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `message_recipient_sent_index` ON `messages` (`recipientUserId`,`sentAt`);--> statement-breakpoint
CREATE INDEX `message_sender_sent_index` ON `messages` (`senderUserId`,`sentAt`);--> statement-breakpoint
CREATE INDEX `recent_view_user_viewed_index` ON `recentViews` (`userId`,`viewedAt`);