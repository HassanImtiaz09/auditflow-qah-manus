/**
 * Integration test setup for AuditFlow.
 *
 * Strategy: no Docker / testcontainers (not available in the sandbox).
 * Instead we use the existing TiDB Cloud database with a unique table-name
 * prefix per test run (e.g. `_int_<runId>_users`).  Every test file:
 *   1. Calls `setupIntegrationDb()` in beforeAll → creates prefixed tables.
 *   2. Calls `teardownIntegrationDb()` in afterAll → drops them.
 *
 * The drizzle instance returned by `setupIntegrationDb()` is scoped to those
 * prefixed tables so it never touches production data.
 *
 * NOTE: This approach requires the DATABASE_URL env var to be set (it is in
 * the sandbox .env).  Tests are skipped automatically when DATABASE_URL is
 * absent (e.g. in a CI environment that has not configured the secret).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { nanoid } from "nanoid";

export type IntegrationDb = ReturnType<typeof drizzle>;

export interface IntegrationContext {
  db: IntegrationDb;
  conn: mysql.Connection;
  prefix: string;
  /** Raw SQL helper — executes against the test connection */
  sql: (query: string, values?: unknown[]) => Promise<mysql.QueryResult>;
  tables: {
    users: string;
    audits: string;
    auditEvents: string;
    auditComments: string;
    consultantNames: string;
    notifications: string;
    refCounters: string;
  };
}

/** Returns true when the DATABASE_URL env is present. */
export function hasDatabaseUrl(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Boot an isolated set of tables for one integration test file.
 * Call this in `beforeAll`.
 */
export async function setupIntegrationDb(): Promise<IntegrationContext> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set — cannot run integration tests");
  }

  const prefix = `_int_${nanoid(8)}_`;
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const sql = (query: string, values?: unknown[]) =>
    conn.query(query, values) as Promise<mysql.QueryResult>;

  const t = {
    users: `\`${prefix}users\``,
    audits: `\`${prefix}audits\``,
    auditEvents: `\`${prefix}auditEvents\``,
    auditComments: `\`${prefix}auditComments\``,
    consultantNames: `\`${prefix}consultantNames\``,
    notifications: `\`${prefix}notifications\``,
    refCounters: `\`${prefix}refCounters\``,
  };

  // ── Create tables ──────────────────────────────────────────────────────────
  await sql(`CREATE TABLE ${t.users} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`openId\` varchar(64) NOT NULL,
    \`name\` text,
    \`email\` varchar(320),
    \`loginMethod\` varchar(64),
    \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
    \`fullName\` varchar(255),
    \`title\` varchar(64),
    \`grade\` varchar(128),
    \`auditRole\` enum('clinician','consultant','admin') DEFAULT 'clinician' NOT NULL,
    \`passwordHash\` varchar(255),
    \`approved\` boolean DEFAULT false NOT NULL,
    \`roleApproved\` boolean DEFAULT false NOT NULL,
    \`linkedConsultantId\` int,
    \`emailVerified\` boolean DEFAULT false NOT NULL,
    \`emailVerifyToken\` varchar(128),
    \`emailVerifyTokenExpiresAt\` timestamp,
    CONSTRAINT \`${prefix}users_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`${prefix}users_openId_unique\` UNIQUE(\`openId\`),
    CONSTRAINT \`${prefix}users_email_unique\` UNIQUE(\`email\`)
  )`);

  await sql(`CREATE TABLE ${t.consultantNames} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`title\` varchar(64),
    \`fullName\` varchar(255) NOT NULL,
    \`grade\` varchar(255),
    \`active\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`${prefix}consultantNames_id\` PRIMARY KEY(\`id\`)
  )`);

  await sql(`CREATE TABLE ${t.refCounters} (
    \`date\` varchar(8) NOT NULL,
    \`counter\` int NOT NULL DEFAULT 0,
    CONSTRAINT \`${prefix}refCounters_date\` PRIMARY KEY(\`date\`)
  )`);

  await sql(`CREATE TABLE ${t.audits} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`refNumber\` varchar(64) NOT NULL,
    \`submittedById\` int NOT NULL,
    \`submitterName\` varchar(255),
    \`submitterEmail\` varchar(320),
    \`submitterGrade\` varchar(128),
    \`supervisorId\` int,
    \`supervisorName\` varchar(255),
    \`category\` varchar(128),
    \`clinicalSetting\` varchar(128),
    \`priority\` enum('Routine','Standard','High','Urgent') NOT NULL DEFAULT 'Routine',
    \`reaudit\` varchar(64),
    \`topic\` varchar(512),
    \`dataCollectionPeriod\` varchar(128),
    \`expectedSampleSize\` varchar(128),
    \`collaborators\` text,
    \`description\` text,
    \`status\` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
    \`decisionNote\` text,
    \`decidedById\` int,
    \`decidedAt\` timestamp,
    \`archived\` boolean NOT NULL DEFAULT false,
    \`submittedAt\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    \`auditObjectives\` text,
    \`auditStandards\` text,
    \`dataCollectionMethodDetail\` text,
    \`reminder7SentAt\` timestamp,
    \`reminder1SentAt\` timestamp,
    CONSTRAINT \`${prefix}audits_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`${prefix}audits_refNumber_unique\` UNIQUE(\`refNumber\`)
  )`);

  await sql(`CREATE TABLE ${t.auditEvents} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`auditId\` int NOT NULL,
    \`actorId\` int,
    \`actorName\` varchar(255),
    \`eventType\` enum('submitted','approved','rejected','reassigned','archived','unarchived','draft_saved','comment') NOT NULL,
    \`detail\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`prevHash\` varchar(64),
    \`hash\` varchar(64),
    CONSTRAINT \`${prefix}auditEvents_id\` PRIMARY KEY(\`id\`)
  )`);

  await sql(`CREATE TABLE ${t.auditComments} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`auditId\` int NOT NULL,
    \`authorId\` int NOT NULL,
    \`authorName\` varchar(255) NOT NULL,
    \`authorRole\` enum('clinician','consultant','admin') NOT NULL,
    \`body\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`${prefix}auditComments_id\` PRIMARY KEY(\`id\`)
  )`);

  await sql(`CREATE TABLE ${t.notifications} (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`recipientId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`type\` enum('consultant_registered','audit_submitted','audit_assigned','audit_reassigned','audit_approved','audit_rejected','account_approved') NOT NULL,
    \`message\` text NOT NULL,
    \`read\` boolean NOT NULL DEFAULT false,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`${prefix}notifications_id\` PRIMARY KEY(\`id\`)
  )`);

  // Build a drizzle instance — we won't use drizzle's schema-aware API here
  // because the table names are dynamic; instead we use raw SQL via `sql()`.
  const db = drizzle(process.env.DATABASE_URL);

  const tableNames = {
    users: `${prefix}users`,
    audits: `${prefix}audits`,
    auditEvents: `${prefix}auditEvents`,
    auditComments: `${prefix}auditComments`,
    consultantNames: `${prefix}consultantNames`,
    notifications: `${prefix}notifications`,
    refCounters: `${prefix}refCounters`,
  };

  return { db, conn, prefix, sql, tables: tableNames };
}

/**
 * Drop all prefixed tables created by `setupIntegrationDb`.
 * Call this in `afterAll`.
 */
export async function teardownIntegrationDb(ctx: IntegrationContext): Promise<void> {
  const { sql, tables, conn } = ctx;
  // Drop in reverse dependency order
  for (const tbl of [
    tables.auditComments,
    tables.auditEvents,
    tables.notifications,
    tables.audits,
    tables.refCounters,
    tables.consultantNames,
    tables.users,
  ]) {
    await sql(`DROP TABLE IF EXISTS \`${tbl}\``);
  }
  await conn.end();
}
