CREATE TABLE `consultantNames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(64),
	`fullName` varchar(255) NOT NULL,
	`grade` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consultantNames_id` PRIMARY KEY(`id`)
);
