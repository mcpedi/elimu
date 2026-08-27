ALTER TABLE `students` ADD `disabledAt` timestamp;--> statement-breakpoint
ALTER TABLE `students` ADD `disabledReason` varchar(255);--> statement-breakpoint
ALTER TABLE `teachers` ADD `disabledAt` timestamp;--> statement-breakpoint
ALTER TABLE `teachers` ADD `disabledReason` varchar(255);