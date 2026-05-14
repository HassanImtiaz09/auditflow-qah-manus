/**
 * Tests for the audit comment thread feature:
 *   - audits.comments — fetch comments (access control)
 *   - audits.addComment — post a comment (access control, audit trail recording)
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
    createAuditComment: vi.fn(),
    getAuditComments: vi.fn(),
    createAuditEvent: vi.fn(),
    getAllAudits: vi.fn(),
  };
});

import {
  getUserById,
  getAuditById,
  createAuditComment,
  getAuditComments,
  createAuditEvent,
} from "./db";

// ─── Context factories ────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1,
    openId: "local-clinician",
    email: "clinician@nhs.net",
    name: "Dr Clinician",
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

// ─── Shared mock data ─────────────────────────────────────────────────────────

const CLINICIAN_DB = {
  id: 1, openId: "local-clinician", email: "clinician@nhs.net",
  name: "Dr Clinician", fullName: "Dr Clinician", title: "Dr",
  grade: "ST3", auditRole: "clinician" as const, passwordHash: "x",
  approved: true, roleApproved: true, loginMethod: "password" as const,
  role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};

const CONSULTANT_DB = {
  ...CLINICIAN_DB, id: 2, openId: "local-consultant",
  email: "consultant@nhs.net", name: "Dr Consultant", fullName: "Dr Consultant",
  grade: "Consultant", auditRole: "consultant" as const,
  // supervisorId on audits is a consultantNames.id; linkedConsultantId must match for access check
  linkedConsultantId: 2,
};

const ADMIN_DB = {
  ...CLINICIAN_DB, id: 3, openId: "local-admin",
  email: "admin@nhs.net", name: "Admin", fullName: "Admin",
  grade: "Admin", auditRole: "admin" as const, role: "admin" as const,
};

const OUTSIDER_DB = {
  ...CLINICIAN_DB, id: 4, openId: "local-outsider",
  email: "outsider@nhs.net", name: "Dr Outsider", fullName: "Dr Outsider",
};

const MOCK_AUDIT = {
  id: 10, refNumber: "REF-20260513-0001",
  submittedById: 1,   // clinician is the submitter
  supervisorId: 2,    // consultant is the supervisor
  submitterName: "Dr Clinician", submitterEmail: "clinician@nhs.net",
  submitterGrade: "ST3", supervisorName: "Dr Consultant",
  category: "ENT", clinicalSetting: "Outpatient",
  priority: "Routine" as const, topic: "Hearing Aid Follow-up",
  description: "Test", status: "pending" as const,
  archived: false, reaudit: null, dataCollectionPeriod: null,
  expectedSampleSize: null, collaborators: null, decisionNote: null,
  decidedById: null, decidedAt: null,
  submittedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
};

const MOCK_COMMENTS = [
  {
    id: 1, auditId: 10, authorId: 1, authorName: "Dr Clinician",
    authorRole: "clinician" as const, body: "Can you clarify the inclusion criteria?",
    createdAt: new Date("2026-05-13T10:00:00Z"),
  },
  {
    id: 2, auditId: 10, authorId: 2, authorName: "Dr Consultant",
    authorRole: "consultant" as const, body: "Include all patients seen in the last 6 months.",
    createdAt: new Date("2026-05-13T11:00:00Z"),
  },
];

// ─── audits.comments ─────────────────────────────────────────────────────────

describe("audits.comments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns comments for the submitter of the audit", async () => {
    vi.mocked(getUserById).mockResolvedValue(CLINICIAN_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);
    vi.mocked(getAuditComments).mockResolvedValue(MOCK_COMMENTS);

    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    const result = await caller.audits.comments({ auditId: 10 });

    expect(result).toHaveLength(2);
    expect(result[0]?.body).toBe("Can you clarify the inclusion criteria?");
    expect(getAuditComments).toHaveBeenCalledWith(10);
  });

  it("returns comments for the assigned supervisor", async () => {
    vi.mocked(getUserById).mockResolvedValue(CONSULTANT_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);
    vi.mocked(getAuditComments).mockResolvedValue(MOCK_COMMENTS);

    const caller = appRouter.createCaller(makeCtx({ id: 2 }));
    const result = await caller.audits.comments({ auditId: 10 });

    expect(result).toHaveLength(2);
  });

  it("returns comments for an admin", async () => {
    vi.mocked(getUserById).mockResolvedValue(ADMIN_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);
    vi.mocked(getAuditComments).mockResolvedValue(MOCK_COMMENTS);

    const caller = appRouter.createCaller(makeCtx({ id: 3 }));
    const result = await caller.audits.comments({ auditId: 10 });

    expect(result).toHaveLength(2);
  });

  it("throws FORBIDDEN for a user who is neither submitter, supervisor, nor admin", async () => {
    vi.mocked(getUserById).mockResolvedValue(OUTSIDER_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);

    const caller = appRouter.createCaller(makeCtx({ id: 4 }));
    await expect(caller.audits.comments({ auditId: 10 })).rejects.toThrow();
    expect(getAuditComments).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the audit does not exist", async () => {
    vi.mocked(getUserById).mockResolvedValue(CLINICIAN_DB);
    vi.mocked(getAuditById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    await expect(caller.audits.comments({ auditId: 999 })).rejects.toThrow();
  });
});

// ─── audits.addComment ────────────────────────────────────────────────────────

describe("audits.addComment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a comment and records a comment audit event", async () => {
    vi.mocked(getUserById).mockResolvedValue(CLINICIAN_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);
    vi.mocked(createAuditComment).mockResolvedValue(MOCK_COMMENTS[0]);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    await caller.audits.addComment({ auditId: 10, body: "Can you clarify the inclusion criteria?" });

    expect(createAuditComment).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        authorId: 1,
        body: "Can you clarify the inclusion criteria?",
      })
    );
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        auditId: 10,
        eventType: "comment",
        detail: expect.stringContaining("Can you clarify"),
      })
    );
  });

  it("truncates the audit trail detail to 120 chars when the body is long", async () => {
    const longBody = "A".repeat(200);
    vi.mocked(getUserById).mockResolvedValue(CLINICIAN_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);
    vi.mocked(createAuditComment).mockResolvedValue({ ...MOCK_COMMENTS[0]!, body: longBody });
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    await caller.audits.addComment({ auditId: 10, body: longBody });

    const eventCall = vi.mocked(createAuditEvent).mock.calls[0]?.[0];
    expect(eventCall?.detail?.length).toBeLessThanOrEqual(124); // 120 + "…"
  });

  it("throws FORBIDDEN for a user who is not the submitter, supervisor, or admin", async () => {
    vi.mocked(getUserById).mockResolvedValue(OUTSIDER_DB);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_AUDIT);

    const caller = appRouter.createCaller(makeCtx({ id: 4 }));
    await expect(
      caller.audits.addComment({ auditId: 10, body: "Hello" })
    ).rejects.toThrow();
    expect(createAuditComment).not.toHaveBeenCalled();
    expect(createAuditEvent).not.toHaveBeenCalled();
  });

  it("throws for an empty body", async () => {
    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    await expect(
      caller.audits.addComment({ auditId: 10, body: "" })
    ).rejects.toThrow();
  });

  it("throws for a body exceeding 2000 characters", async () => {
    const caller = appRouter.createCaller(makeCtx({ id: 1 }));
    await expect(
      caller.audits.addComment({ auditId: 10, body: "x".repeat(2001) })
    ).rejects.toThrow();
  });
});
