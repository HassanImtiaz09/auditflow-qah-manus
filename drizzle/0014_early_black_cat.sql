CREATE TABLE `refCounters` (
	`date` varchar(8) NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	CONSTRAINT `refCounters_date` PRIMARY KEY(`date`)
);
