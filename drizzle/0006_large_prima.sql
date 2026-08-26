CREATE TABLE `reportCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`studentId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`termId` int NOT NULL,
	`classId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int NOT NULL,
	`title` varchar(140) NOT NULL,
	`resultSnapshot` json NOT NULL,
	`totalMarks` decimal(10,2) NOT NULL,
	`averagePercentage` decimal(6,2) NOT NULL,
	`meanPoints` decimal(6,2) NOT NULL,
	`overallGrade` varchar(4) NOT NULL,
	`teacherComment` text,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportCards_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_card_student_term_unique` UNIQUE(`studentId`,`termId`)
);
--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_academicYearId_academicYears_id_fk` FOREIGN KEY (`academicYearId`) REFERENCES `academicYears`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_termId_terms_id_fk` FOREIGN KEY (`termId`) REFERENCES `terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_classId_schoolClasses_id_fk` FOREIGN KEY (`classId`) REFERENCES `schoolClasses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportCards` ADD CONSTRAINT `reportCards_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `report_card_school_published_index` ON `reportCards` (`schoolId`,`publishedAt`);