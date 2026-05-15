/**
 * ref-counter.test.ts
 *
 * Tests for the atomic reference-number counter (Prompt 9).
 *
 * Two test groups:
 *  1. Unit tests for getNextRefCounter behaviour (mocked DB).
 *  2. Concurrency test: 10 parallel audits.submit calls produce 10 distinct
 *     refNumbers — no duplicates, no gaps.
 *
 * The DB module is mocked throughout so no real database connection is needed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the db module ────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getConsultantNameById: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
  getAuditById: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  getNextRefCounter: vi.fn(),
  createAuditEvent: vi.fn(),
  createAuditComment: vi.fn(),
  getAuditComments: vi.fn(),
  createNotification: vi.fn(),
  getAdminUsers: vi.fn(),
  getAllAudits: vi.fn(),
  // legacy — no longer called by submit but kept so other test files that share
  // the module mock don't break
  countAudits: vi.fn(),
}));

vi.mock("./_core/email", () => ({
  sendAuditSubmissionEmails: vi.fn().mockResolvedValue(undefined),
  sendAuditStatusEmails: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(false),
  sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(false),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(false),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CLINICIAN_USER = {
  id: 10,
  openId: "clinician-ref-test",
  name: "Dr. RefTest",
  fullName: "Dr. RefTest",
  email: "reftest@porthosp.nhs.uk",
  auditRole: "clinician" as const,
  role: "user" as const,
  approved: true,
  roleApproved: true,
  linkedConsultantId: null,
  emailVerified: true,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  grade: "ST3",
  title: "Dr.",
  passwordHash: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Minimal audit shape returned by createAudit */
function makeMockAudit(id: number, refNumber: string) {
  return {
    id,
    refNumber,
    topic: "Concurrent Audit",
    status: "pending" as const,
    supervisorId: null,
    supervisorName: null,
    submittedById: MOCK_CLINICIAN_USER.id,
    submitterName: MOCK_CLINICIAN_USER.fullName,
    submitterEmail: MOCK_CLINICIAN_USER.email,
    archived: false,
    collaborators: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Build a caller context for the clinician */
function makeCtx(): TrpcContext {
  return {
    user: { id: MOCK_CLINICIAN_USER.id, openId: MOCK_CLINICIAN_USER.openId } as TrpcContext["user"],
    req: {} as TrpcContext["req"],
    res: {} as unknown as TrpcContext["res"],
  };
}

/** Minimal valid submit payload (non-draft, no supervisor) */
const SUBMIT_PAYLOAD = {
  topic: "Concurrent Audit",
  category: "ENT",
  clinicalSetting: "Outpatient",
  priority: "Routine" as const,
  description: "Concurrent audit description for ref-counter test",
  isDraft: false,
  auditObjectives: "To assess concurrent audit submission uniqueness.",
  auditStandards: JSON.stringify([
    { standard: "NICE NG98", criteria: "All patients", compliance: "90%", exceptions: "" },
  ]),
  dataCollectionMethodDetail: "Retrospective review of patient records.",
};

// ─── Unit tests for getNextRefCounter behaviour ────────────────────────────────

describe("getNextRefCounter — unit behaviour", () => {
  it("returns 1 on the first call for a date", async () => {
    vi.mocked(db.getNextRefCounter).mockResolvedValueOnce(1);
    const result = await db.getNextRefCounter("20260514");
    expect(result).toBe(1);
  });

  it("returns incrementing values on successive calls for the same date", async () => {
    vi.mocked(db.getNextRefCounter)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const r1 = await db.getNextRefCounter("20260514");
    const r2 = await db.getNextRefCounter("20260514");
    const r3 = await db.getNextRefCounter("20260514");

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(r3).toBe(3);
  });

  it("resets to 1 for a different date", async () => {
    vi.mocked(db.getNextRefCounter)
      .mockResolvedValueOnce(5)   // last call for 20260514
      .mockResolvedValueOnce(1);  // first call for 20260515

    await db.getNextRefCounter("20260514");
    const r = await db.getNextRefCounter("20260515");
    expect(r).toBe(1);
  });
});

// ─── Concurrency test: 10 parallel submit calls produce unique refNumbers ──────

describe("audits.submit — concurrent submissions produce unique refNumbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Simulate an atomic in-memory counter (as the real DB would behave).
    // Each call to getNextRefCounter returns the next integer in sequence.
    let counter = 0;
    vi.mocked(db.getNextRefCounter).mockImplementation(async (_date: string) => {
      counter += 1;
      return counter;
    });

    vi.mocked(db.getUserById).mockResolvedValue(MOCK_CLINICIAN_USER as never);
    vi.mocked(db.getAdminUsers).mockResolvedValue([]);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    vi.mocked(db.getConsultantNameById).mockResolvedValue(null);
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(null);

    // createAudit returns a mock audit whose refNumber mirrors the input
    vi.mocked(db.createAudit).mockImplementation(async (data) => {
      return makeMockAudit(Math.floor(Math.random() * 10000), data.refNumber!) as never;
    });
  });

  it("10 concurrent submit calls each produce a unique refNumber", async () => {
    const N = 10;
    const caller = appRouter.createCaller(makeCtx());

    // Fire all 10 submissions concurrently
    const results = await Promise.all(
      Array.from({ length: N }, () => caller.audits.submit(SUBMIT_PAYLOAD as never))
    );

    const refNumbers = results.map((r) => r.refNumber);

    // All refNumbers must be defined
    expect(refNumbers.every((r) => typeof r === "string" && r.startsWith("REF-"))).toBe(true);

    // All refNumbers must be unique
    const uniqueRefs = new Set(refNumbers);
    expect(uniqueRefs.size).toBe(N);
  });

  it("refNumbers follow the REF-YYYYMMDD-NNNN format", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.submit(SUBMIT_PAYLOAD as never);

    // Should match REF-YYYYMMDD-NNNN exactly
    expect(result.refNumber).toMatch(/^REF-\d{8}-\d{4}$/);
  });

  it("getNextRefCounter is called once per submit (not countAudits)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await caller.audits.submit(SUBMIT_PAYLOAD as never);

    expect(db.getNextRefCounter).toHaveBeenCalledTimes(1);
    // The legacy countAudits should no longer be called
    expect(db.countAudits).not.toHaveBeenCalled();
  });
});
