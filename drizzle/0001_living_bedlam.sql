CREATE TABLE `user_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
