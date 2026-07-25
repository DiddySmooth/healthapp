CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text,
	`owner_id` integer,
	`name` text NOT NULL,
	`log_type` text NOT NULL,
	`dataset_category` text,
	`level` text,
	`mechanic` text,
	`force` text,
	`equipment` text,
	`primary_muscles` text DEFAULT '[]' NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`instructions` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_external_id_unique` ON `exercises` (`external_id`);