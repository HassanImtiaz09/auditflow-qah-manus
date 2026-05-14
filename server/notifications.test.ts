/**
 * Tests for Round 5 in-app notification logic:
 *   - audits.decide sends audit_approved / audit_rejected notification to submitter
 *   - audits.reassign sends audit_reassigned notification to newly assigned consultant
 *   - No notification sent when supervisor is removed (null supervisorId)
 *
 * All DB helpers are mocked so no real database connection is required.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database helpers ────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserById: vi.fn(),
    getAuditById: vi.fn(),
    updateAudit: vi.fn(),
    createAuditEvent: vi.fn(),
    createNotification: vi.fn(),
    getApprovedConsultants: vi.fn(),
  };
});

import {
  getUserById,
  getAuditById,
  updateAudit,
  createAuditEvent,
  createNotification,
} from "./db";

// ─── Context factories ────────────────────────────────────────────────────────

function createAuthContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1,
    openId: "local-test-clinician",
    email: "clinician@nhs.net",
    name: "Dr Test Clinician",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createConsultantContext(): TrpcContext {
  return createAuthContext({
    id: 2,
    openId: "local-test-consultant",
    email: "consultant@nhs.net",
    name: "Dr Test Consultant",
  });
}

function createAdminContext(): TrpcContext {
  return createAuthContext({
    id: 3,
    openId: "local-test-admin",
    email: "admin@nhs.net",
    name: "Admin User",
    role: "admin",
  });
}

// ─── Shared mock data ─────────────────────────────────────────────────────────

const MOCK_CLINICIAN_DB_USER = {
  id: 1,
  openId: "local-test-clinician",
  email: "clinician@nhs.net",
  name: "Dr Test Clinician",
  fullName: "Dr Test Clinician",
  title: "Dr",
  grade: "ST3",
  auditRole: "clinician" as const,
  passwordHash: "hashed",
  approved: true,
  roleApproved: true,
  loginMethod: "password" as const,
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const MOCK_CONSULTANT_DB_USER = {
  ...MOCK_CLINICIAN_DB_USER,
  id: 2,
  openId: "local-test-consultant",
  email: "consultant@nhs.net",
  name: "Dr Test Consultant",
  fullName: "Dr Test Consultant",
  grade: "Consultant",
  auditRole: "consultant" as const,
  // supervisorId on audits references consultantNames.id, so linkedConsultantId
  // must match MOCK_PENDING_AUDIT.supervisorId (2) for the decide check to pass.
  linkedConsultantId: 2,
};

const MOCK_ADMIN_DB_USER = {
  ...MOCK_CLINICIAN_DB_USER,
  id: 3,
  openId: "local-test-admin",
  email: "admin@nhs.net",
  name: "Admin User",
  fullName: "Admin User",
  grade: "Admin",
  auditRole: "admin" as const,
  role: "admin" as const,
};

const MOCK_PENDING_AUDIT = {
  id: 10,
  refNumber: "REF-20260513-0001",
  submittedById: 1,
  submitterName: "Dr Test Clinician",
  submitterEmail: "clinician@nhs.net",
  submitterGrade: "ST3",
  supervisorId: 2,
  supervisorName: "Dr Test Consultant",
  category: "ENT",
  clinicalSetting: "Outpatient",
  priority: "Routine" as const,
  topic: "Hearing Aid Follow-up",
  description: "Audit of hearing aid follow-up protocols",
  status: "pending" as const,
  archived: false,
  reaudit: null,
  dataCollectionPeriod: null,
  expectedSampleSize: null,
  collaborators: null,
  decisionNote: null,
  decidedById: null,
  decidedAt: null,
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── audits.decide — notification to submitter ───────────────────────────────

describe("audits.decide — submitter notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an audit_approved notification to the submitter on approval", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "approved" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({ auditId: 10, decision: "approved", note: "Well structured." });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 1, // submitter id
        type: "audit_approved",
      })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("REF-20260513-0001"),
      })
    );
  });

  it("sends an audit_rejected notification to the submitter on rejection", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "rejected" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({ auditId: 10, decision: "rejected", note: "Needs more detail." });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 1,
        type: "audit_rejected",
      })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Needs more detail."),
      })
    );
  });

  it("includes the decision note in the notification message when provided", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "approved" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({ auditId: 10, decision: "approved", note: "Excellent work." });

    const call = vi.mocked(createNotification).mock.calls[0]?.[0];
    expect(call?.message).toContain("Excellent work.");
  });

  it("does NOT include a note suffix when no note is provided", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "approved" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({ auditId: 10, decision: "approved" });

    const call = vi.mocked(createNotification).mock.calls[0]?.[0];
    expect(call?.message).not.toContain("Note:");
  });
});

// ─── audits.reassign — notification to newly assigned consultant ──────────────

describe("audits.reassign — consultant notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an audit_reassigned notification to the newly assigned consultant", async () => {
    // getUserById is called twice: once for the admin actor, once for the new supervisor
    vi.mocked(getUserById)
      .mockResolvedValueOnce(MOCK_ADMIN_DB_USER)   // actor (admin)
      .mockResolvedValueOnce(MOCK_CONSULTANT_DB_USER); // new supervisor
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.reassign({ auditId: 10, supervisorId: 2 });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 2, // new consultant id
        type: "audit_reassigned",
      })
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("REF-20260513-0001"),
      })
    );
  });

  it("does NOT send a notification when the supervisor is removed (null supervisorId)", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, supervisorId: null, supervisorName: null });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.reassign({ auditId: 10, supervisorId: null });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when a non-admin tries to reassign", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CLINICIAN_DB_USER);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audits.reassign({ auditId: 10, supervisorId: 2 })).rejects.toThrow();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
