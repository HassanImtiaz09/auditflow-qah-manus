CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`refNumber` varchar(64) NOT NULL,
	`submittedById` int NOT NULL,
	`submitterName` varchar(255),
	`submitterEmail` varchar(320),
	`submitterGrade` varchar(128),
	`supervisorId` int,
	`supervisorName` varchar(255),
	`category` varchar(128),
	`clinicalSetting` varchar(128),
	`priority` enum('Routine','Standard','High','Urgent') NOT NULL DEFAULT 'Routine',
	`reaudit` varchar(64),
	`topic` varchar(512),
	`dataCollectionPeriod` varchar(128),
	`expectedSampleSize` varchar(128),
	`collaborators` text,
	`description` text,
	`status` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
	`decisionNote` text,
	`decidedById` int,
	`decidedAt` timestamp,
	`archived` boolean NOT NULL DEFAULT false,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`),
	CONSTRAINT `audits_refNumber_unique` UNIQUE(`refNumber`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('consultant_registered','audit_submitted') NOT NULL,
	`message` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `fullName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `title` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `grade` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `auditRole` enum('clinician','consultant','admin') DEFAULT 'clinician' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `approved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `roleApproved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);