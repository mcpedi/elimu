CREATE TABLE `studentCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`passwordHash` varchar(255),
	`activationCodeHash` varchar(255),
	`activationCodeExpiresAt` timestamp,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_credentials_student_unique` UNIQUE(`studentId`)
);
--> statement-breakpoint
ALTER TABLE `studentCredentials` ADD CONSTRAINT `studentCredentials_studentId_students_id_fk` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;