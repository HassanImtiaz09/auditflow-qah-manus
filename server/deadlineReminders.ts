/**
 * deadlineReminders.ts
 *
 * Handler for the scheduled deadline-reminder cron job.
 *
 * Endpoint: GET /api/scheduled/deadline-reminders
 * Auth:     x-cron-secret header must match process.env.CRON_SECRET
 *
 * Logic:
 *   1. Fetch all active (non-archived) audits in 'pending' or 'approved' status
 *      with a non-null auditEndDate.
 *   2. For each audit, compute days remaining until auditEndDate.
 *   3. If 7 ± 0.5 days remain and reminder7SentAt is null → send 7-day reminder.
 *   4. If 1 ± 0.5 days remain and reminder1SentAt is null → send 1-day reminder.
 *   5. For each reminder sent:
 *      - Email the submitter and all collaborators (parsed from JSON array).
 *      - Create an in-app notification for the submitter.
 *      - Set the corresponding reminder*SentAt timestamp.
 *
 * Returns: { processed: number, sent: { sevenDay: number, oneDay: number } }
 *
 * The handler is idempotent: if a reminder has already been sent (reminder*SentAt
 * is not null), it is skipped even if the audit is still in the window.
 *
 * Note: The cron is registered as a project-level Heartbeat job via the
 * manus-heartbeat CLI (not from server code) per periodic-updates.md §4a.
 * Run after deployment:
 *   manus-heartbeat create \
 *     --name deadline-reminders \
 *     --cron "0 0 7 * * *" \
 *     --path /api/scheduled/deadline-reminders \
 *     --description "Daily 07:00 UTC deadline reminder emails"
 */

import type { Request, Response } from "express";
import {
  getAuditsForDeadlineReminder,
  updateAuditReminderSent,
  createNotification,
  getUserById,
} from "./db";
import { sendDeadlineReminderEmail } from "./_core/email";

/** Half-day tolerance window in milliseconds (12 hours). */
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/** One day in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the number of whole days remaining from `now` until `deadline`.
 * Returns a negative number if the deadline has already passed.
 */
export function daysRemaining(now: Date, deadline: Date): number {
  return (deadline.getTime() - now.getTime()) / ONE_DAY_MS;
}

/**
 * Returns true if `days` is within ±0.5 of `target`.
 */
export function inWindow(days: number, target: number): boolean {
  return Math.abs(days - target) <= 0.5;
}

/**
 * Parse the collaborators JSON column into an array of { name, email } objects.
 * Returns an empty array if the column is null, empty, or malformed.
 */
export function parseCollaborators(
  raw: string | null | undefined
): Array<{ name: string; email: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c) => c && typeof c.email === "string" && c.email.trim()
    );
  } catch {
    return [];
  }
}

/**
 * Express handler for GET /api/scheduled/deadline-reminders.
 *
 * Exported for testing. Mounted in server/_core/index.ts.
 */
export async function deadlineRemindersHandler(
  req: Request,
  res: Response
): Promise<void> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ error: "CRON_SECRET is not configured" });
    return;
  }
  const provided = req.headers["x-cron-secret"];
  if (provided !== cronSecret) {
    res.status(401).json({ error: "Unauthorized: invalid x-cron-secret" });
    return;
  }

  // ── Fetch eligible audits ─────────────────────────────────────────────────
  let audits: Awaited<ReturnType<typeof getAuditsForDeadlineReminder>>;
  try {
    audits = await getAuditsForDeadlineReminder();
  } catch (err) {
    res.status(500).json({
      error: String(err),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const now = new Date();
  let sevenDaySent = 0;
  let oneDaySent = 0;

  for (const audit of audits) {
    if (!audit.auditEndDate) continue;

    const days = daysRemaining(now, audit.auditEndDate);

    // ── 7-day window ────────────────────────────────────────────────────────
    if (inWindow(days, 7) && audit.reminder7SentAt == null) {
      await sendReminders(audit, Math.round(days), "reminder7SentAt");
      sevenDaySent++;
    }

    // ── 1-day window ────────────────────────────────────────────────────────
    if (inWindow(days, 1) && audit.reminder1SentAt == null) {
      await sendReminders(audit, Math.round(days), "reminder1SentAt");
      oneDaySent++;
    }
  }

  res.json({
    processed: audits.length,
    sent: { sevenDay: sevenDaySent, oneDay: oneDaySent },
  });
}

/**
 * Send reminder emails to the submitter + collaborators and create an in-app
 * notification for the submitter. Then mark the reminder as sent.
 */
async function sendReminders(
  audit: Awaited<ReturnType<typeof getAuditsForDeadlineReminder>>[number],
  daysLeft: number,
  field: "reminder7SentAt" | "reminder1SentAt"
): Promise<void> {
  const collaborators = parseCollaborators(audit.collaborators);

  // Build recipient list: submitter + collaborators (deduplicated by email)
  const recipients: Array<{ name: string; email: string }> = [];

  if (audit.submitterEmail) {
    recipients.push({
      name: audit.submitterName ?? "Clinician",
      email: audit.submitterEmail,
    });
  }

  for (const c of collaborators) {
    if (!recipients.some((r) => r.email === c.email)) {
      recipients.push({ name: c.name ?? c.email, email: c.email });
    }
  }

  // Send emails
  for (const recipient of recipients) {
    try {
      await sendDeadlineReminderEmail({
        to: recipient.email,
        recipientName: recipient.name,
        refNumber: audit.refNumber ?? "",
        topic: audit.topic ?? "Untitled Audit",
        daysRemaining: daysLeft,
        auditEndDate: audit.auditEndDate!,
      });
    } catch (err) {
      console.warn(
        `[DeadlineReminder] Failed to send email to ${recipient.email} for audit ${audit.id}:`,
        err
      );
    }
  }

  // In-app notification for the submitter
  if (audit.submittedById) {
    try {
      const submitter = await getUserById(audit.submittedById);
      if (submitter) {
        const label = daysLeft <= 1 ? "tomorrow" : `in ${daysLeft} days`;
        await createNotification({
          recipientId: audit.submittedById,
          userId: audit.submittedById,
          type: "audit_submitted", // closest available type for "reminder"
          message: `Deadline reminder: "${audit.topic ?? "Audit"}" (${audit.refNumber}) is due ${label}.`,
        });
      }
    } catch (err) {
      console.warn(
        `[DeadlineReminder] Failed to create notification for audit ${audit.id}:`,
        err
      );
    }
  }

  // Mark reminder as sent
  try {
    await updateAuditReminderSent(audit.id, field);
  } catch (err) {
    console.warn(
      `[DeadlineReminder] Failed to update ${field} for audit ${audit.id}:`,
      err
    );
  }
}
