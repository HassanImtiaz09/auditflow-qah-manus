/**
 * deadline-reminder.test.ts
 *
 * Tests for the deadline-reminder scheduled handler (Prompt 10).
 *
 * Groups:
 *  1. Unit tests for helper functions (daysRemaining, inWindow, parseCollaborators).
 *  2. Integration-style tests for deadlineRemindersHandler using supertest.
 *     - Auth: missing / wrong secret → 401.
 *     - No eligible audits → { processed: 0, sent: { sevenDay: 0, oneDay: 0 } }.
 *     - Audit in 7-day window → email sent, reminder7SentAt updated.
 *     - Audit in 1-day window → email sent, reminder1SentAt updated.
 *     - Audit already reminded → skipped.
 *     - Audit outside both windows → skipped.
 *     - CRON_SECRET validates correctly.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mock db and email modules ────────────────────────────────────────────────

vi.mock("./db", () => ({
  getAuditsForDeadlineReminder: vi.fn(),
  updateAuditReminderSent: vi.fn(),
  createNotification: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("./_core/email", () => ({
  sendDeadlineReminderEmail: vi.fn().mockResolvedValue(true),
  sendReauditReminderEmail: vi.fn().mockResolvedValue(true),
  sendAuditSubmissionEmails: vi.fn().mockResolvedValue(undefined),
  sendAuditStatusEmails: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(false),
  sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(false),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(false),
}));

import * as db from "./db";
import * as email from "./_core/email";
import {
  daysRemaining,
  inWindow,
  parseCollaborators,
  deadlineRemindersHandler,
} from "./deadlineReminders";

// ─── Test secret ──────────────────────────────────────────────────────────────

const TEST_SECRET = "test-cron-secret-abc123";

// ─── Helper: build a minimal Express app with the handler mounted ─────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get("/api/scheduled/deadline-reminders", deadlineRemindersHandler);
  return app;
}

// ─── Helper: build a mock audit row ──────────────────────────────────────────

function makeAudit(overrides: Partial<{
  id: number;
  refNumber: string;
  topic: string;
  status: "pending" | "approved";
  archived: boolean;
  auditEndDate: Date | null;
  reminder7SentAt: Date | null;
  reminder1SentAt: Date | null;
  submittedById: number;
  submitterName: string;
  submitterEmail: string;
  collaborators: string | null;
}> = {}) {
  return {
    id: 1,
    refNumber: "REF-20260514-0001",
    topic: "ENT Audit",
    status: "pending" as const,
    archived: false,
    auditEndDate: null,
    reminder7SentAt: null,
    reminder1SentAt: null,
    submittedById: 10,
    submitterName: "Dr. Smith",
    submitterEmail: "smith@porthosp.nhs.uk",
    collaborators: null,
    ...overrides,
  };
}

// ─── Unit tests for helper functions ─────────────────────────────────────────

describe("daysRemaining", () => {
  it("returns positive days when deadline is in the future", () => {
    const now = new Date("2026-05-14T07:00:00Z");
    const deadline = new Date("2026-05-21T07:00:00Z");
    expect(daysRemaining(now, deadline)).toBeCloseTo(7, 1);
  });

  it("returns negative days when deadline has passed", () => {
    const now = new Date("2026-05-21T07:00:00Z");
    const deadline = new Date("2026-05-14T07:00:00Z");
    expect(daysRemaining(now, deadline)).toBeLessThan(0);
  });

  it("returns ~0 when deadline is today", () => {
    const now = new Date("2026-05-14T07:00:00Z");
    const deadline = new Date("2026-05-14T19:00:00Z");
    expect(Math.abs(daysRemaining(now, deadline))).toBeLessThan(1);
  });
});

describe("inWindow", () => {
  it("returns true when days is exactly at target", () => {
    expect(inWindow(7, 7)).toBe(true);
    expect(inWindow(1, 1)).toBe(true);
  });

  it("returns true when days is within ±0.5 of target", () => {
    expect(inWindow(7.4, 7)).toBe(true);
    expect(inWindow(6.6, 7)).toBe(true);
    expect(inWindow(1.4, 1)).toBe(true);
    expect(inWindow(0.6, 1)).toBe(true);
  });

  it("returns false when days is outside ±0.5 of target", () => {
    expect(inWindow(7.6, 7)).toBe(false);
    expect(inWindow(6.4, 7)).toBe(false);
    expect(inWindow(3, 7)).toBe(false);
    expect(inWindow(0, 7)).toBe(false);
  });
});

describe("parseCollaborators", () => {
  it("returns empty array for null input", () => {
    expect(parseCollaborators(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCollaborators("")).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseCollaborators("{not-json}")).toEqual([]);
  });

  it("parses valid collaborator JSON", () => {
    const raw = JSON.stringify([
      { name: "Dr. Jones", email: "jones@porthosp.nhs.uk" },
      { name: "Dr. Brown", email: "brown@porthosp.nhs.uk" },
    ]);
    const result = parseCollaborators(raw);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("jones@porthosp.nhs.uk");
  });

  it("filters out entries without an email", () => {
    const raw = JSON.stringify([
      { name: "Dr. Jones", email: "jones@porthosp.nhs.uk" },
      { name: "No Email" },
    ]);
    expect(parseCollaborators(raw)).toHaveLength(1);
  });
});

// ─── Integration tests for deadlineRemindersHandler ──────────────────────────

describe("deadlineRemindersHandler — auth", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = TEST_SECRET;
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when x-cron-secret header is missing", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scheduled/deadline-reminders");
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-cron-secret header is wrong", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct x-cron-secret header", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);
    expect(res.status).toBe(200);
  });

  it("returns 500 when CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET;
    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);
    expect(res.status).toBe(500);
  });
});

describe("deadlineRemindersHandler — reminder logic", () => {
  let originalSecret: string | undefined;

  // "today" is 2026-05-14T07:00:00Z
  const TODAY = new Date("2026-05-14T07:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = TEST_SECRET;
    // Stub Date.now / new Date to return TODAY
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    vi.mocked(db.updateAuditReminderSent).mockResolvedValue(undefined);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 10,
      openId: "clinician-1",
      name: "Dr. Smith",
    } as never);
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("returns { processed: 0, sent: { sevenDay: 0, oneDay: 0, reaudit: 0 } } when no audits", async () => {
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([]);
    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ processed: 0, sent: { sevenDay: 0, oneDay: 0, reaudit: 0 } });
  });

  it("sends 7-day reminder for audit due in ~7 days (reminder7SentAt null)", async () => {
    const deadline = new Date(TODAY.getTime() + 7 * 24 * 60 * 60 * 1000); // exactly 7 days
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({ id: 1, auditEndDate: deadline, reminder7SentAt: null }) as never,
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.sent.sevenDay).toBe(1);
    expect(res.body.sent.oneDay).toBe(0);
    expect(email.sendDeadlineReminderEmail).toHaveBeenCalledOnce();
    expect(db.updateAuditReminderSent).toHaveBeenCalledWith(1, "reminder7SentAt");
  });

  it("sends 1-day reminder for audit due in ~1 day (reminder1SentAt null)", async () => {
    const deadline = new Date(TODAY.getTime() + 1 * 24 * 60 * 60 * 1000); // exactly 1 day
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({ id: 2, auditEndDate: deadline, reminder1SentAt: null }) as never,
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    expect(res.status).toBe(200);
    expect(res.body.sent.sevenDay).toBe(0);
    expect(res.body.sent.oneDay).toBe(1);
    expect(email.sendDeadlineReminderEmail).toHaveBeenCalledOnce();
    expect(db.updateAuditReminderSent).toHaveBeenCalledWith(2, "reminder1SentAt");
  });

  it("skips 7-day reminder if reminder7SentAt is already set", async () => {
    const deadline = new Date(TODAY.getTime() + 7 * 24 * 60 * 60 * 1000);
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({
        id: 3,
        auditEndDate: deadline,
        reminder7SentAt: new Date("2026-05-07T07:00:00Z"), // already sent
      }) as never,
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    expect(res.body.sent.sevenDay).toBe(0);
    expect(email.sendDeadlineReminderEmail).not.toHaveBeenCalled();
  });

  it("skips audit outside both windows (e.g. 14 days away)", async () => {
    const deadline = new Date(TODAY.getTime() + 14 * 24 * 60 * 60 * 1000);
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({ id: 4, auditEndDate: deadline }) as never,
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    expect(res.body.sent.sevenDay).toBe(0);
    expect(res.body.sent.oneDay).toBe(0);
    expect(email.sendDeadlineReminderEmail).not.toHaveBeenCalled();
  });

  it("sends emails to collaborators as well as the submitter", async () => {
    const deadline = new Date(TODAY.getTime() + 7 * 24 * 60 * 60 * 1000);
    const collaborators = JSON.stringify([
      { name: "Dr. Jones", email: "jones@porthosp.nhs.uk" },
    ]);
    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({ id: 5, auditEndDate: deadline, collaborators }) as never,
    ]);

    const app = buildApp();
    await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    // Should have been called for submitter + 1 collaborator = 2 calls
    expect(email.sendDeadlineReminderEmail).toHaveBeenCalledTimes(2);
  });

  it("processes multiple audits and counts correctly", async () => {
    const sevenDayDeadline = new Date(TODAY.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayDeadline = new Date(TODAY.getTime() + 1 * 24 * 60 * 60 * 1000);
    const farDeadline = new Date(TODAY.getTime() + 30 * 24 * 60 * 60 * 1000);

    vi.mocked(db.getAuditsForDeadlineReminder).mockResolvedValue([
      makeAudit({ id: 10, auditEndDate: sevenDayDeadline }) as never,
      makeAudit({ id: 11, auditEndDate: oneDayDeadline }) as never,
      makeAudit({ id: 12, auditEndDate: farDeadline }) as never,
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scheduled/deadline-reminders")
      .set("x-cron-secret", TEST_SECRET);

    expect(res.body.processed).toBe(3);
    expect(res.body.sent.sevenDay).toBe(1);
    expect(res.body.sent.oneDay).toBe(1);
  });
});
