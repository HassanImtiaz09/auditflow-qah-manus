import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier — kept for template compatibility, not used for our custom auth */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** Display name */
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** System role: admin | user (Manus template default) */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),

  // ── AuditFlow-specific fields ──────────────────────────────────────────────
  /** Full name as entered at registration */
  fullName: varchar("fullName", { length: 255 }),
  /** NHS title (Dr, Mr, Miss, Prof, etc.) */
  title: varchar("title", { length: 64 }),
  /** Clinical grade from GRADES list */
  grade: varchar("grade", { length: 128 }),
  /** AuditFlow role: clinician | consultant | admin */
  auditRole: mysqlEnum("auditRole", ["clinician", "consultant", "admin"])
    .default("clinician")
    .notNull(),
  /** bcrypt-hashed password */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Whether the account is approved to log in */
  approved: boolean("approved").default(false).notNull(),
  /** Whether the consultant role has been approved by admin */
  roleApproved: boolean("roleApproved").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Audits ───────────────────────────────────────────────────────────────────

export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  refNumber: varchar("refNumber", { length: 64 }).notNull().unique(),
  /** FK → users.id (submitter) */
  submittedById: int("submittedById").notNull(),
  /** Denormalised submitter name for display */
  submitterName: varchar("submitterName", { length: 255 }),
  submitterEmail: varchar("submitterEmail", { length: 320 }),
  submitterGrade: varchar("submitterGrade", { length: 128 }),
  /** FK → users.id (supervising consultant) — nullable */
  supervisorId: int("supervisorId"),
  /** Denormalised supervisor name for display */
  supervisorName: varchar("supervisorName", { length: 255 }),

  category: varchar("category", { length: 128 }),
  clinicalSetting: varchar("clinicalSetting", { length: 128 }),
  priority: mysqlEnum("priority", ["Routine", "Standard", "High", "Urgent"])
    .default("Routine")
    .notNull(),
  reaudit: varchar("reaudit", { length: 64 }),
  topic: varchar("topic", { length: 512 }),
  dataCollectionPeriod: varchar("dataCollectionPeriod", { length: 128 }),
  expectedSampleSize: varchar("expectedSampleSize", { length: 128 }),
  collaborators: text("collaborators"), // JSON array stored as text
  description: text("description"),

  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected"])
    .default("draft")
    .notNull(),
  /** Consultant's decision note */
  decisionNote: text("decisionNote"),
  /** FK → users.id (consultant who decided) */
  decidedById: int("decidedById"),
  decidedAt: timestamp("decidedAt"),

  archived: boolean("archived").default(false).notNull(),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

  // ── Step 2: Clinical Audit Registration Form fields ──────────────────────
  /** JSON array of selected reasons: e.g. ["NICE","National audit","Other"] */
  reasonForAudit: text("reasonForAudit"),
  reasonForAuditOther: varchar("reasonForAuditOther", { length: 512 }),
  /** CQC Regulation reference */
  cqcRegulation: varchar("cqcRegulation", { length: 512 }),
  /** Priority classification: national | regional | local */
  priorityType: mysqlEnum("priorityType", ["national", "regional", "local"]),
  priorityTypeOther: varchar("priorityTypeOther", { length: 512 }),
  /** JSON array of support required options */
  supportRequired: text("supportRequired"),
  supportRequiredOther: varchar("supportRequiredOther", { length: 512 }),
  /** Planned start date */
  auditStartDate: timestamp("auditStartDate"),
  /** Planned end date */
  auditEndDate: timestamp("auditEndDate"),
  /** What outcomes does this audit aim to achieve */
  auditObjectives: text("auditObjectives"),
  /** Who will be involved and their roles */
  whoInvolved: text("whoInvolved"),
  /** JSON array of {standard, criteria, compliance, exceptions} rows */
  auditStandards: text("auditStandards"),
  /** Evidence base for the standards (NICE, Royal Colleges, etc.) */
  evidenceBase: text("evidenceBase"),
  /** Stakeholder list (free text) */
  stakeholders: text("stakeholders"),
  /** Whether stakeholders have been informed */
  stakeholdersInformed: boolean("stakeholdersInformed").default(false),
  /** JSON array of data source options */
  dataSource: text("dataSource"),
  dataSourceOther: varchar("dataSourceOther", { length: 512 }),
  /** Method of data collection (questionnaire, proforma, etc.) */
  dataCollectionMethodDetail: text("dataCollectionMethodDetail"),
  /** retrospective | prospective */
  dataCollectionTiming: mysqlEnum("dataCollectionTiming", ["retrospective", "prospective"]),
  /** Who will collect the data */
  dataCollectedBy: varchar("dataCollectedBy", { length: 512 }),
  /** Sampling method description */
  samplingMethodDetail: text("samplingMethodDetail"),
  /** Data analysis description */
  dataAnalysisDetail: text("dataAnalysisDetail"),
  /** Who will analyse the data */
  dataAnalysedBy: varchar("dataAnalysedBy", { length: 512 }),
  /** JSON array of results presentation targets */
  resultsPresentation: text("resultsPresentation"),
  resultsPresentationOther: varchar("resultsPresentationOther", { length: 512 }),
  /** Who is responsible for the action plan */
  actionPlanOwner: varchar("actionPlanOwner", { length: 512 }),
  /** Potential barriers to change */
  barriersToChange: text("barriersToChange"),
  /** Re-audit timeline: na | 6months | 12months | other */
  reAuditTimeline: mysqlEnum("reAuditTimeline", ["na", "6months", "12months", "other"]),
  reAuditTimelineOther: varchar("reAuditTimelineOther", { length: 256 }),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────────

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id (recipient — always admin for now) */
  recipientId: int("recipientId").notNull(),
  /** FK → users.id (the user who triggered the notification) */
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["consultant_registered", "audit_submitted", "audit_reassigned", "audit_approved", "audit_rejected"]).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  /** FK -> users.id */
  userId: int("userId").notNull(),
  /** Secure random token (hex) */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Expiry timestamp */
  expiresAt: timestamp("expiresAt").notNull(),
  /** Whether the token has been used */
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// --- Audit Events (Audit Trail) -----------------------------------------------

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  /** FK -> audits.id */
  auditId: int("auditId").notNull(),
  /** FK -> users.id (who performed the action) */
  actorId: int("actorId"),
  /** Denormalised actor name for display */
  actorName: varchar("actorName", { length: 255 }),
  /** Event type */
  eventType: mysqlEnum("eventType", [
    "submitted",
    "approved",
    "rejected",
    "reassigned",
    "archived",
    "unarchived",
    "draft_saved",
    "comment",
  ]).notNull(),
  /** Optional human-readable detail (e.g. decision note, new supervisor name) */
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;

// --- Audit Comments (Q&A Thread) ---------------------------------------------

export const auditComments = mysqlTable("auditComments", {
  id: int("id").autoincrement().primaryKey(),
  /** FK -> audits.id */
  auditId: int("auditId").notNull(),
  /** FK -> users.id */
  authorId: int("authorId").notNull(),
  /** Denormalised author name for display */
  authorName: varchar("authorName", { length: 255 }).notNull(),
  /** AuditFlow role of the author at time of posting */
  authorRole: mysqlEnum("authorRole", ["clinician", "consultant", "admin"]).notNull(),
  /** Comment body (plain text, max 2000 chars) */
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditComment = typeof auditComments.$inferSelect;
export type InsertAuditComment = typeof auditComments.$inferInsert;
