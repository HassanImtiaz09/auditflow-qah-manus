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
  ]).notNull(),
  /** Optional human-readable detail (e.g. decision note, new supervisor name) */
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
