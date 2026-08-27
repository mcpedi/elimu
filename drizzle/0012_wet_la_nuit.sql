ALTER TABLE `users` ADD `disabledAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `disabledReason` varchar(255);