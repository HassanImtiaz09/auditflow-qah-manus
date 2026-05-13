CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`actorId` int,
	`actorName` varchar(255),
	`eventType` enum('submitted','approved','rejected','reassigned','archived','unarchived','draft_saved') NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
