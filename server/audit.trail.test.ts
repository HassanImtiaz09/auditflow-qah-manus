/**
 * Tests for the audit trail feature:
 *   - createAuditEvent DB helper
 *   - getAuditEvents DB helper
 *   - audits.history tRPC procedure
 *   - audit events recorded during submit, decide, reassign, and archive mutations
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
    // Audit event helpers
    createAuditEvent: vi.fn(),
    getAuditEvents: vi.fn(),
    // Helpers needed by audits.submit
    getUserById: vi.fn(),
    countAudits: vi.fn(),
    createAudit: vi.fn(),
    // Helpers needed by audits.decide
    getAuditById: vi.fn(),
    updateAudit: vi.fn(),
    // Helpers needed by audits.reassign
    getApprovedConsultants: vi.fn(),
    // Helpers needed by audits.archive
    getAllAudits: vi.fn(),
  };
});

import {
  createAuditEvent,
  getAuditEvents,
  getUserById,
  countAudits,
  createAudit,
  getAuditById,
  updateAudit,
} from "./db";

// ─── Context factories ────────────────────────────────────────────────────────

/** Minimal authenticated context for a clinician */
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

/** Minimal authenticated context for a consultant */
function createConsultantContext(): TrpcContext {
  return createAuthContext({ id: 2, openId: "local-test-consultant", email: "consultant@nhs.net", name: "Dr Test Consultant" });
}

/** Minimal authenticated context for an admin */
function createAdminContext(): TrpcContext {
  return createAuthContext({ id: 3, openId: "local-test-admin", email: "admin@nhs.net", name: "Admin User", role: "admin" });
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
  decisionComment: null,
  isDraft: false,
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── audits.history procedure ─────────────────────────────────────────────────

describe("audits.history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns events for a given auditId in chronological order", async () => {
    const mockEvents = [
      {
        id: 1,
        auditId: 10,
        actorId: 1,
        actorName: "Dr Test Clinician",
        eventType: "submitted" as const,
        detail: null,
        createdAt: new Date("2026-05-13T10:00:00Z"),
      },
      {
        id: 2,
        auditId: 10,
        actorId: 3,
        actorName: "Admin User",
        eventType: "reassigned" as const,
        detail: "Reassigned to Dr Test Consultant",
        createdAt: new Date("2026-05-13T11:00:00Z"),
      },
    ];

    vi.mocked(getAuditEvents).mockResolvedValue(mockEvents);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.audits.history({ auditId: 10 });

    expect(result).toHaveLength(2);
    expect(result[0]?.eventType).toBe("submitted");
    expect(result[1]?.eventType).toBe("reassigned");
    expect(getAuditEvents).toHaveBeenCalledWith(10);
  });

  it("returns an empty array when no events exist for the audit", async () => {
    vi.mocked(getAuditEvents).mockResolvedValue([]);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.audits.history({ auditId: 99 });

    expect(result).toEqual([]);
    expect(getAuditEvents).toHaveBeenCalledWith(99);
  });

  it("requires authentication — throws UNAUTHORIZED for unauthenticated caller", async () => {
    const unauthCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.audits.history({ auditId: 10 })).rejects.toThrow();
  });
});

// ─── Audit event recording: audits.decide ────────────────────────────────────

describe("audits.decide — audit trail recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an 'approved' event when a consultant approves an audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "approved" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({
      auditId: 10,
      decision: "approved",
      note: "Looks good",
    });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 2,
        eventType: "approved",
      })
    );
  });

  it("records a 'rejected' event when a consultant rejects an audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, status: "rejected" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createConsultantContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.decide({
      auditId: 10,
      decision: "rejected",
      note: "Needs more detail",
    });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 2,
        eventType: "rejected",
      })
    );
  });

  it("throws FORBIDDEN when a non-supervisor tries to decide", async () => {
    // Clinician (id=1) is not the supervisor (id=2) of the audit
    vi.mocked(getUserById).mockResolvedValue(MOCK_CLINICIAN_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);

    const ctx = createAuthContext(); // clinician, id=1
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audits.decide({ auditId: 10, decision: "approved", note: "" })
    ).rejects.toThrow();

    expect(createAuditEvent).not.toHaveBeenCalled();
  });
});

// ─── Audit event recording: audits.archive ───────────────────────────────────

describe("audits.archive — audit trail recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an 'archived' event when an admin archives an audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, archived: true });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.archive({ auditId: 10, archived: true });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 3,
        eventType: "archived",
      })
    );
  });

  it("records an 'unarchived' event when an admin restores an audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue({ ...MOCK_PENDING_AUDIT, archived: true });
    vi.mocked(updateAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, archived: false });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.archive({ auditId: 10, archived: false });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 3,
        eventType: "unarchived",
      })
    );
  });
});

// ─── Audit event recording: audits.reassign ──────────────────────────────────

describe("audits.reassign — audit trail recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a 'reassigned' event with the new supervisor name", async () => {
    vi.mocked(getUserById)
      .mockResolvedValueOnce(MOCK_ADMIN_DB_USER) // actor (admin performing the reassign)
      .mockResolvedValueOnce(MOCK_CONSULTANT_DB_USER); // new supervisor lookup
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({
      ...MOCK_PENDING_AUDIT,
      supervisorId: 2,
      supervisorName: "Dr Test Consultant",
    });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.reassign({ auditId: 10, supervisorId: 2 });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 3,
        eventType: "reassigned",
        detail: expect.stringContaining("Dr Test Consultant"),
      })
    );
  });

  it("records a 'reassigned' event noting supervisor removal when supervisorId is null", async () => {
    vi.mocked(getUserById).mockResolvedValueOnce(MOCK_ADMIN_DB_USER);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT);
    vi.mocked(updateAudit).mockResolvedValue({
      ...MOCK_PENDING_AUDIT,
      supervisorId: null,
      supervisorName: null,
    });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.reassign({ auditId: 10, supervisorId: null });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        actorId: 3,
        eventType: "reassigned",
        detail: "Supervisor removed",
      })
    );
  });
});

// ─── Audit event recording: audits.submit ────────────────────────────────────

describe("audits.submit — audit trail recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a 'submitted' event when a clinician submits a new audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CLINICIAN_DB_USER);
    vi.mocked(countAudits).mockResolvedValue(0);
    vi.mocked(createAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, id: 11 });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.submit({
      category: "ENT",
      clinicalSetting: "Outpatient",
      priority: "Routine",
      topic: "Hearing Aid Follow-up",
      description: "Audit of hearing aid follow-up protocols in ENT outpatient",
      isDraft: false,
    });

    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 1,
        eventType: "submitted",
      })
    );
  });

  it("does NOT record an event when saving as draft", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CLINICIAN_DB_USER);
    vi.mocked(countAudits).mockResolvedValue(0);
    vi.mocked(createAudit).mockResolvedValue({ ...MOCK_PENDING_AUDIT, id: 12, status: "draft" });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.audits.submit({
      category: "ENT",
      clinicalSetting: "Outpatient",
      priority: "Routine",
      topic: "Draft Hearing Aid Audit",
      description: "Draft audit of hearing aid follow-up protocols in ENT outpatient",
      isDraft: true,
    });

    expect(createAuditEvent).not.toHaveBeenCalled();
  });
});
