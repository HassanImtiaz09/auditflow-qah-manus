import { createHash } from "crypto";
import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { auditComments, auditEvents, audits, consultantNames, emailHistory, InsertAuditComment, InsertAuditEvent, InsertConsultantName, InsertEmailHistory, InsertUser, notifications, passwordResetTokens, refCounters, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn({ err: error }, "[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const fields = ["name", "email", "loginMethod", "fullName", "title", "grade", "passwordHash"] as const;
  for (const f of fields) {
    const v = user[f];
    if (v !== undefined) { values[f] = v ?? null; updateSet[f] = v ?? null; }
  }
  if (user.auditRole !== undefined) { values.auditRole = user.auditRole; updateSet.auditRole = user.auditRole; }
  if (user.approved !== undefined) { values.approved = user.approved; updateSet.approved = user.approved; }
  if (user.roleApproved !== undefined) { values.roleApproved = user.roleApproved; updateSet.roleApproved = user.roleApproved; }
  // `role` is legacy/Manus-template — pass through if explicitly provided, but do not use for access decisions.
  // Access decisions must use `auditRole` (canonical).
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  // Ensure the platform owner always has admin auditRole, is approved, and has roleApproved.
  if (user.openId === ENV.ownerOpenId) {
    if (user.auditRole === undefined) { values.auditRole = "admin"; updateSet.auditRole = "admin"; }
    if (user.approved === undefined) { values.approved = true; updateSet.approved = true; }
    if (user.roleApproved === undefined) { values.roleApproved = true; updateSet.roleApproved = true; }
  }

  values.lastSignedIn = new Date();
  updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return r[0];
}

export async function getUserByEmailVerifyToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.emailVerifyToken, token)).limit(1);
  return r[0];
}

export async function setEmailVerifyToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerifyToken: token, emailVerifyTokenExpiresAt: expiresAt }).where(eq(users.id, userId));
}

export async function markEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerified: true, emailVerifyToken: null, emailVerifyTokenExpiresAt: null }).where(eq(users.id, userId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return r[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getApprovedConsultants() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(and(eq(users.auditRole, "consultant"), eq(users.roleApproved, true), eq(users.approved, true)));
}

/** Returns all active entries from the consultantNames roster table */
export async function getConsultantNames() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(consultantNames)
    .where(eq(consultantNames.active, true))
    .orderBy(consultantNames.fullName);
}

/** Returns a single consultantNames row by its primary key */
export async function getConsultantNameById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(consultantNames).where(eq(consultantNames.id, id)).limit(1);
  return r[0];
}

/** Adds a new name to the consultantNames roster */
export async function addConsultantName(data: Omit<InsertConsultantName, 'createdAt'>) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.insert(consultantNames).values({ ...data, createdAt: new Date() });
  // Fetch the newly inserted row by fullName (most recent)
  const rows = await db
    .select()
    .from(consultantNames)
    .where(eq(consultantNames.fullName, data.fullName))
    .orderBy(desc(consultantNames.id))
    .limit(1);
  return rows[0];
}

/** Returns ALL consultantNames entries (active and inactive) for admin roster UI */
export async function getAllConsultantNames() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultantNames).orderBy(consultantNames.fullName);
}

/** Update a consultantNames entry (title, fullName, grade) */
export async function updateConsultantName(
  id: number,
  data: { title?: string | null; fullName?: string; grade?: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(consultantNames).set(data).where(eq(consultantNames.id, id));
  return getConsultantNameById(id);
}

/** Soft-delete a consultantNames entry by setting active = false */
export async function deactivateConsultantName(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(consultantNames).set({ active: false }).where(eq(consultantNames.id, id));
}

/** Re-activate a previously deactivated consultantNames entry */
export async function reactivateConsultantName(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(consultantNames).set({ active: true }).where(eq(consultantNames.id, id));
}

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(or(eq(users.approved, false), and(eq(users.auditRole, "consultant"), eq(users.roleApproved, false))))
    .orderBy(desc(users.createdAt));
}

export async function approveUser(id: number, linkedConsultantId?: number | null) {
  const db = await getDb();
  if (!db) return;
  if (linkedConsultantId !== undefined) {
    await db.update(users).set({ approved: true, roleApproved: true, linkedConsultantId: linkedConsultantId ?? null }).where(eq(users.id, id));
  } else {
    await db.update(users).set({ approved: true, roleApproved: true }).where(eq(users.id, id));
  }
}

/** Returns all audits assigned to a consultant (all statuses except draft) */
export async function getAuditsForConsultantAll(consultantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(
      eq(audits.supervisorId, consultantId),
      ne(audits.status, "draft"),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(desc(audits.createdAt));
}

/** Finds the user account that is linked to a given seeded consultant id */
export async function getUserByLinkedConsultantId(linkedConsultantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.linkedConsultantId, linkedConsultantId)).limit(1);
  return r[0];
}

export async function rejectUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

export async function searchUsersByName(query: string) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query}%`;
  return db
    .select()
    .from(users)
    .where(or(like(users.fullName, q), like(users.name, q), like(users.email, q)))
    .limit(20);
}

export async function updateUserRole(id: number, auditRole: "clinician" | "consultant" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ auditRole }).where(eq(users.id, id));
}

/** Update (or clear) the linkedConsultantId for a user account */
export async function updateLinkedConsultant(userId: number, linkedConsultantId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ linkedConsultantId }).where(eq(users.id, userId));
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

export async function getAllAudits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(audits)
    .where(sql`${audits.deletedAt} IS NULL`)
    .orderBy(desc(audits.createdAt));
}

/** Admin-only: returns ALL audits including soft-deleted ones (for restore UI) */
export async function getAllAuditsIncludeDeleted() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(audits).orderBy(desc(audits.createdAt));
}

export async function getAuditById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Returns the row regardless of deletedAt so individual lookups (trail, restore) still work
  const r = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return r[0];
}

export async function getAuditByRef(ref: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(audits).where(eq(audits.refNumber, ref)).limit(1);
  return r[0];
}

/**
 * Public status lookup — returns ONLY the fields safe to expose without authentication.
 * No description, emails, decision notes, or submitter info.
 */
export async function getAuditPublicStatus(ref: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      refNumber: audits.refNumber,
      status: audits.status,
      decidedAt: audits.decidedAt,
      category: audits.category,
    })
    .from(audits)
    .where(eq(audits.refNumber, ref))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAuditsForConsultant(consultantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(
      eq(audits.supervisorId, consultantId),
      eq(audits.status, "pending"),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(desc(audits.createdAt));
}

export async function countAudits() {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select().from(audits);
  return r.length;
}

export async function createAudit(data: typeof audits.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(audits).values(data);
  const r = await db.select().from(audits).where(eq(audits.refNumber, data.refNumber!)).limit(1);
  return r[0];
}

export async function updateAudit(id: number, data: Partial<typeof audits.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(audits).set(data).where(eq(audits.id, id));
  return getAuditById(id);
}

export async function getMyAudits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(
      eq(audits.submittedById, userId),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(desc(audits.createdAt));
}

export async function getMyDraftAudits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(
      eq(audits.submittedById, userId),
      eq(audits.status, "draft"),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(desc(audits.updatedAt));
}

/** Soft-delete an audit by setting deletedAt = now(). Does NOT hard-delete. */
export async function softDeleteAudit(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(audits).set({ deletedAt: new Date() }).where(eq(audits.id, id));
}

/** Admin-only: restore a soft-deleted audit by clearing deletedAt. */
export async function restoreAudit(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(audits).set({ deletedAt: null }).where(eq(audits.id, id));
}

// ─── Admin overview helpers ─────────────────────────────────────────────────

/** Counts all audits grouped by status (excludes drafts, excludes soft-deleted) for admin overview */
export async function getAdminOverviewStats() {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, drafts: 0, changes_requested: 0 };
  const all = await db.select().from(audits).where(sql`${audits.deletedAt} IS NULL`);
  return {
    total: all.filter(a => a.status !== 'draft').length,
    pending: all.filter(a => a.status === 'pending').length,
    approved: all.filter(a => a.status === 'approved').length,
    rejected: all.filter(a => a.status === 'rejected').length,
    changes_requested: all.filter(a => a.status === 'changes_requested').length,
    drafts: all.filter(a => a.status === 'draft').length,
  };
}

/** For each consultant name in the roster, counts their pending/approved/rejected audits */
export async function getAuditsPerConsultant() {
  const db = await getDb();
  if (!db) return [];
  const names = await db.select().from(consultantNames).where(eq(consultantNames.active, true)).orderBy(consultantNames.fullName);
  const allAudits = await db.select().from(audits).where(and(
    ne(audits.status, 'draft'),
    sql`${audits.deletedAt} IS NULL`,
  ));
  return names.map(cn => ({
    id: cn.id,
    fullName: cn.fullName,
    grade: cn.grade ?? null,
    pending: allAudits.filter(a => a.supervisorId === cn.id && a.status === 'pending').length,
    approved: allAudits.filter(a => a.supervisorId === cn.id && a.status === 'approved').length,
    rejected: allAudits.filter(a => a.supervisorId === cn.id && a.status === 'rejected').length,
    total: allAudits.filter(a => a.supervisorId === cn.id).length,
  }));
}

/** Returns audits with auditEndDate within the next N days and status pending or approved */
export async function getApproachingDeadlines(daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const all = await db
    .select()
    .from(audits)
    .where(and(
      or(eq(audits.status, 'pending'), eq(audits.status, 'approved')),
      ne(audits.status, 'draft'),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(audits.auditEndDate);
  return all.filter(a => {
    if (!a.auditEndDate) return false;
    const d = new Date(a.auditEndDate);
    return d >= now && d <= cutoff;
  });
}

/**
 * Returns approaching deadlines for a specific consultant's assigned audits.
 * Used by ConsultantDashboard P23.
 */
export async function getApproachingDeadlinesForConsultant(consultantId: number, daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const all = await db
    .select()
    .from(audits)
    .where(and(
      eq(audits.supervisorId, consultantId),
      or(eq(audits.status, 'pending'), eq(audits.status, 'approved')),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(audits.auditEndDate);
  return all.filter(a => {
    if (!a.auditEndDate) return false;
    const d = new Date(a.auditEndDate);
    return d >= now && d <= cutoff;
  });
}

/**
 * Returns approaching deadlines for a specific clinician's own submitted audits.
 * Used by ClinicianDashboard P23.
 */
export async function getApproachingDeadlinesForUser(userId: number, daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const all = await db
    .select()
    .from(audits)
    .where(and(
      eq(audits.submittedById, userId),
      or(eq(audits.status, 'pending'), eq(audits.status, 'approved')),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(audits.auditEndDate);
  return all.filter(a => {
    if (!a.auditEndDate) return false;
    const d = new Date(a.auditEndDate);
    return d >= now && d <= cutoff;
  });
}

/** Returns the most recent N submitted audits (status != draft) across all users */
export async function getRecentRegistrations(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(
      ne(audits.status, 'draft'),
      sql`${audits.deletedAt} IS NULL`,
    ))
    .orderBy(desc(audits.submittedAt))
    .limit(limit);
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.auditRole, "admin")).limit(20);
}

export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getUnreadNotifications(recipientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.read, false)))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(recipientId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.read, false)));
}

// ─── Password Reset Token helpers ────────────────────────────────────────────

export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return;
  // Invalidate any existing unused tokens for this user
  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.used, false)));
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserProfile(
  userId: number,
  data: { fullName?: string; title?: string; email?: string; grade?: string }
) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.fullName !== undefined) { updateSet.fullName = data.fullName; updateSet.name = data.fullName; }
  if (data.title !== undefined) updateSet.title = data.title;
  if (data.email !== undefined) updateSet.email = data.email;
  if (data.grade !== undefined) updateSet.grade = data.grade;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

// ─── Audit Event helpers (Audit Trail) ───────────────────────────────────────

/**
 * Compute the SHA-256 hash for an audit trail event.
 *
 * The hash covers: prevHash + a stable JSON serialisation of the event's
 * content fields (auditId, actorId, actorName, eventType, detail, createdAt).
 * The `hash` and `prevHash` fields themselves are excluded from the input so
 * the computation is deterministic regardless of insertion order.
 *
 * @param prevHash  The hash of the preceding event in this audit's chain,
 *                  or the sentinel "0" for the very first event.
 * @param event     The event data (without hash fields).
 */
export function computeEventHash(
  prevHash: string,
  event: Pick<InsertAuditEvent, "auditId" | "actorId" | "actorName" | "eventType" | "detail" | "createdAt">
): string {
  const payload = prevHash + JSON.stringify({
    auditId: event.auditId,
    actorId: event.actorId ?? null,
    actorName: event.actorName ?? null,
    eventType: event.eventType,
    detail: event.detail ?? null,
    // Normalise to ISO string so the hash is stable across JS Date / DB round-trips
    createdAt: event.createdAt instanceof Date
      ? event.createdAt.toISOString()
      : String(event.createdAt),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export async function createAuditEvent(data: InsertAuditEvent) {
  const db = await getDb();
  if (!db) return;

  // Fetch the most recent event for this audit to get the chain tip
  const [lastEvent] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.auditId, data.auditId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);

  const prevHash = lastEvent?.hash ?? "0";
  const now = data.createdAt ?? new Date();
  const hash = computeEventHash(prevHash, { ...data, createdAt: now });

  await db.insert(auditEvents).values({ ...data, createdAt: now, prevHash, hash });
}

export async function getAuditEvents(auditId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.auditId, auditId))
    .orderBy(auditEvents.createdAt);
}

// ─── Audit Comment helpers (Q&A Thread) ──────────────────────────────────────

export async function createAuditComment(data: InsertAuditComment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(auditComments).values(data);
  // Return the newly inserted comment
  const rows = await db
    .select()
    .from(auditComments)
    .where(eq(auditComments.auditId, data.auditId))
    .orderBy(desc(auditComments.createdAt))
    .limit(1);
  return rows[0];
}

export async function getAuditComments(auditId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditComments)
    .where(eq(auditComments.auditId, auditId))
    .orderBy(auditComments.createdAt);
}

// ─── Atomic reference-number counter ─────────────────────────────────────────

/**
 * Atomically increment the per-date counter and return the new value.
 *
 * Uses INSERT ... ON DUPLICATE KEY UPDATE so concurrent callers on the same
 * calendar date each receive a distinct, monotonically increasing integer.
 * The returned value is used as the NNNN sequence in REF-YYYYMMDD-NNNN.
 *
 * @param date  Calendar date in YYYYMMDD format, e.g. "20260514"
 * @returns     The new counter value (1-based)
 */
export async function getNextRefCounter(date: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Atomically insert-or-increment the counter for this date.
  // Drizzle's onDuplicateKeyUpdate maps to MySQL's ON DUPLICATE KEY UPDATE.
  await db
    .insert(refCounters)
    .values({ date, counter: 1 })
    .onDuplicateKeyUpdate({ set: { counter: sql`counter + 1` } });

  // Read back the committed value.
  const rows = await db
    .select({ counter: refCounters.counter })
    .from(refCounters)
    .where(eq(refCounters.date, date))
    .limit(1);

  const counter = rows[0]?.counter;
  if (counter == null) throw new Error(`refCounters row missing for date ${date}`);
  return counter;
}

// ─── Deadline reminder helpers ────────────────────────────────────────────────

/**
 * Return all active (non-archived, non-deleted) audits in 'pending' or 'approved' status
 * that have a non-null auditEndDate. Used by the deadline-reminder cron handler
 * to identify audits approaching their deadline.
 */
export async function getAuditsForDeadlineReminder() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(
      and(
        eq(audits.archived, false),
        or(eq(audits.status, "pending"), eq(audits.status, "approved")),
        sql`${audits.auditEndDate} IS NOT NULL`,
        sql`${audits.deletedAt} IS NULL`,
      )
    );
}

/**
 * Return all approved audits that have a re-audit timeline of 6months or 12months,
 * a decidedAt timestamp, and have not yet had a re-audit reminder sent.
 * Used by the re-audit reminder cron handler (Prompt 27).
 */
export async function getAuditsForReauditReminder() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(
      and(
        eq(audits.status, "approved"),
        sql`${audits.reAuditTimeline} IN ('6months', '12months')`,
        sql`${audits.decidedAt} IS NOT NULL`,
        sql`${audits.reauditReminderSentAt} IS NULL`,
        sql`${audits.deletedAt} IS NULL`,
      )
    );
}

/** Mark the re-audit reminder as sent for an audit */
export async function markReauditReminderSent(id: number, sentAt: Date = new Date()): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(audits).set({ reauditReminderSentAt: sentAt }).where(eq(audits.id, id));
}

/**
 * Mark a reminder as sent by setting the appropriate timestamp column.
 * @param id       The audit ID
 * @param field    Which reminder column to update: "reminder7SentAt" | "reminder1SentAt"
 * @param sentAt   The timestamp to record (defaults to now)
 */
export async function updateAuditReminderSent(
  id: number,
  field: "reminder7SentAt" | "reminder1SentAt",
  sentAt: Date = new Date()
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(audits)
    .set({ [field]: sentAt })
    .where(eq(audits.id, id));
}


// ─── Email History helpers ────────────────────────────────────────────────────

/**
 * Log an email to the history table for audit trail and notification history display.
 */
export async function logEmailHistory(record: InsertEmailHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(emailHistory).values(record);
  } catch (err) {
    logger.warn({ err, record }, "[EmailHistory] Failed to log email");
  }
}

/**
 * Get all emails for a specific audit, ordered by most recent first.
 */
export async function getEmailHistoryForAudit(auditId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailHistory)
    .where(eq(emailHistory.auditId, auditId))
    .orderBy(desc(emailHistory.sentAt));
}

/**
 * Get all emails sent to a specific supervisor (by email address), ordered by most recent first.
 * Used for the supervisor dashboard notification history.
 */
export async function getEmailHistoryForSupervisor(supervisorEmail: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(emailHistory)
    .where(eq(emailHistory.recipientEmail, supervisorEmail))
    .orderBy(desc(emailHistory.sentAt))
    .limit(limit);
}

/**
 * Get email statistics for a supervisor (count by type, total sent, failed, etc.)
 */
export async function getEmailHistoryStatsForSupervisor(supervisorEmail: string) {
  const db = await getDb();
  if (!db) return { total: 0, sent: 0, failed: 0, byType: {} };

  const rows = await db
    .select({
      status: emailHistory.status,
      emailType: emailHistory.emailType,
      count: sql<number>`COUNT(*)`,
    })
    .from(emailHistory)
    .where(eq(emailHistory.recipientEmail, supervisorEmail))
    .groupBy(emailHistory.status, emailHistory.emailType);

  const stats = { total: 0, sent: 0, failed: 0, byType: {} as Record<string, number> };
  for (const row of rows) {
    stats.total += row.count;
    if (row.status === "sent") stats.sent += row.count;
    if (row.status === "failed") stats.failed += row.count;
    stats.byType[row.emailType] = (stats.byType[row.emailType] || 0) + row.count;
  }
  return stats;
}
