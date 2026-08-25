CREATE TABLE `reportExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`reportType` varchar(100) NOT NULL,
	`format` enum('pdf','excel') NOT NULL,
	`filters` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reportExports` ADD CONSTRAINT `reportExports_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportExports` ADD CONSTRAINT `reportExports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `report_export_school_created_index` ON `reportExports` (`schoolId`,`createdAt`);