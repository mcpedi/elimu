CREATE TABLE `aiConversationMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiConversationMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`schoolId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160) NOT NULL DEFAULT 'New conversation',
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `aiConversationMessages` ADD CONSTRAINT `aiConversationMessages_conversationId_aiConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `aiConversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiConversationMessages` ADD CONSTRAINT `aiConversationMessages_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiConversationMessages` ADD CONSTRAINT `aiConversationMessages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiConversations` ADD CONSTRAINT `aiConversations_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiConversations` ADD CONSTRAINT `aiConversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_message_conversation_created_index` ON `aiConversationMessages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_message_school_user_index` ON `aiConversationMessages` (`schoolId`,`userId`);--> statement-breakpoint
CREATE INDEX `ai_conversation_user_recent_index` ON `aiConversations` (`userId`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `ai_conversation_school_user_index` ON `aiConversations` (`schoolId`,`userId`);