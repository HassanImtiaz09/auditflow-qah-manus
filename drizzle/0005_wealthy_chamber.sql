CREATE TABLE `auditComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`authorId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`authorRole` enum('clinician','consultant','admin') NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditComments_id` PRIMARY KEY(`id`)
);
