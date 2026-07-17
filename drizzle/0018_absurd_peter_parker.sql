CREATE TABLE `emailHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientName` varchar(255),
	`emailType` enum('submission','status_change','deadline_reminder_7day','deadline_reminder_1day','reassignment','reaudit_reminder') NOT NULL,
	`subject` varchar(512) NOT NULL,
	`body` text,
	`auditRefNumber` varchar(64),
	`auditTopic` varchar(512),
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emailHistory_id` PRIMARY KEY(`id`)
);
