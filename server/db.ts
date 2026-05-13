import { and, desc, eq, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { auditComments, auditEvents, audits, InsertAuditComment, InsertAuditEvent, InsertUser, notifications, passwordResetTokens, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
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
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }

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

export async function getPendingUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(or(eq(users.approved, false), and(eq(users.auditRole, "consultant"), eq(users.roleApproved, false))))
    .orderBy(desc(users.createdAt));
}

export async function approveUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ approved: true, roleApproved: true }).where(eq(users.id, id));
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

// ─── Audit helpers ────────────────────────────────────────────────────────────

export async function getAllAudits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(audits).orderBy(desc(audits.createdAt));
}

export async function getAuditById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return r[0];
}

export async function getAuditByRef(ref: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(audits).where(eq(audits.refNumber, ref)).limit(1);
  return r[0];
}

export async function getAuditsForConsultant(consultantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(eq(audits.supervisorId, consultantId), eq(audits.status, "pending")))
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
    .where(eq(audits.submittedById, userId))
    .orderBy(desc(audits.createdAt));
}

export async function getMyDraftAudits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(audits)
    .where(and(eq(audits.submittedById, userId), eq(audits.status, "draft")))
    .orderBy(desc(audits.updatedAt));
}

export async function deleteAudit(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(audits).where(eq(audits.id, id));
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export async function getAdminUser() {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.auditRole, "admin")).limit(1);
  return r[0];
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

export async function createAuditEvent(data: InsertAuditEvent) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values(data);
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
