/**
 * decide-guards.test.ts
 *
 * Tests for the defensive guards added in Prompt 17:
 * 1. audits.decide — pending-status guard (BAD_REQUEST if not pending)
 * 2. audits.decide — role/variant consistency (consultant cannot use admin_override_*, admin must use admin_override_*)
 * 3. audits.decide — admin_override variants resolve to canonical status and add "Admin override —" prefix in trail
 * 4. audits.reassign — pending-status guard (BAD_REQUEST if not pending)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";

// ── Mock dependencies ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getAuditById: vi.fn(),
  updateAudit: vi.fn(),
  createAuditEvent: vi.fn(),
  createNotification: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
  getConsultantNameById: vi.fn(),
  getNextRefCounter: vi.fn(),
}));
vi.mock("./_core/email", () => ({
  sendAuditStatusEmails: vi.fn(),
  sendDeadlineReminderEmail: vi.fn(),
  buildNewSupervisorAssignedEmail: vi.fn(),
}));

import {
  getUserById,
  getAuditById,
  updateAudit,
  createAuditEvent,
  createNotification,
  getUserByLinkedConsultantId,
  getConsultantNameById,
} from "./db";
import { sendAuditStatusEmails } from "./_core/email";

// ── Shared mock data ─────────────────────────────────────────────────────────
const MOCK_CONSULTANT_USER = {
  id: 10,
  email: "consultant@example.com",
  name: "Dr Consultant",
  fullName: "Dr Consultant",
  auditRole: "consultant" as const,
  role: "user" as const,
  linkedConsultantId: 5,
  approved: true,
  roleApproved: true,
  emailVerified: 1,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  passwordHash: null,
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  openId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_ADMIN_USER = {
  id: 1,
  email: "admin@example.com",
  name: "Admin User",
  fullName: "Admin User",
  auditRole: "admin" as const,
  role: "admin" as const,
  linkedConsultantId: null,
  approved: true,
  roleApproved: true,
  emailVerified: 1,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  passwordHash: null,
  passwordResetToken: null,
  passwordResetTokenExpiresAt: null,
  openId: "owner-open-id",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_PENDING_AUDIT = {
  id: 100,
  refNumber: "REF-20260101-0001",
  status: "pending" as const,
  supervisorId: 5,
  supervisorName: "Dr Consultant",
  submittedById: 20,
  collaborators: "[]",
  title: "Test Audit",
  description: "Test",
  category: "general" as const,
  decisionNote: null,
  decidedById: null,
  decidedAt: null,
  archived: false,
  auditEndDate: null,
  reminder7SentAt: null,
  reminder1SentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_APPROVED_AUDIT = { ...MOCK_PENDING_AUDIT, status: "approved" as const };
const MOCK_REJECTED_AUDIT = { ...MOCK_PENDING_AUDIT, status: "rejected" as const };

function makeConsultantCaller() {
  return appRouter.createCaller({ user: { id: MOCK_CONSULTANT_USER.id } } as any);
}
function makeAdminCaller() {
  return appRouter.createCaller({ user: { id: MOCK_ADMIN_USER.id } } as any);
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("audits.decide — pending-status guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_USER as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined as any);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined as any);
    vi.mocked(createNotification).mockResolvedValue(undefined as any);
    vi.mocked(sendAuditStatusEmails).mockResolvedValue(undefined as any);
  });

  it("throws BAD_REQUEST when deciding an already-approved audit", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_APPROVED_AUDIT as any);
    const caller = makeConsultantCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "approved" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("not pending") });
  });

  it("throws BAD_REQUEST when deciding an already-rejected audit", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_REJECTED_AUDIT as any);
    const caller = makeConsultantCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "rejected" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("not pending") });
  });

  it("succeeds when the audit is pending", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT as any);
    const caller = makeConsultantCaller();
    const result = await caller.audits.decide({ auditId: 100, decision: "approved" });
    expect(result.success).toBe(true);
  });
});

describe("audits.decide — role/variant consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined as any);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined as any);
    vi.mocked(createNotification).mockResolvedValue(undefined as any);
    vi.mocked(sendAuditStatusEmails).mockResolvedValue(undefined as any);
  });

  it("throws FORBIDDEN when consultant uses admin_override_approved", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_USER as any);
    const caller = makeConsultantCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "admin_override_approved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("Consultants cannot use admin override") });
  });

  it("throws FORBIDDEN when consultant uses admin_override_rejected", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_CONSULTANT_USER as any);
    const caller = makeConsultantCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "admin_override_rejected" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when admin uses regular 'approved' (must use override variant)", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_USER as any);
    const caller = makeAdminCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "approved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("admin_override") });
  });

  it("throws FORBIDDEN when admin uses regular 'rejected'", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_USER as any);
    const caller = makeAdminCaller();
    await expect(
      caller.audits.decide({ auditId: 100, decision: "rejected" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("audits.decide — admin_override variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_USER as any);
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined as any);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined as any);
    vi.mocked(createNotification).mockResolvedValue(undefined as any);
    vi.mocked(sendAuditStatusEmails).mockResolvedValue(undefined as any);
  });

  it("admin_override_approved resolves to canonical status 'approved'", async () => {
    const caller = makeAdminCaller();
    await caller.audits.decide({ auditId: 100, decision: "admin_override_approved", note: "Override reason" });
    expect(vi.mocked(updateAudit)).toHaveBeenCalledWith(100, expect.objectContaining({ status: "approved" }));
  });

  it("admin_override_rejected resolves to canonical status 'rejected'", async () => {
    const caller = makeAdminCaller();
    await caller.audits.decide({ auditId: 100, decision: "admin_override_rejected" });
    expect(vi.mocked(updateAudit)).toHaveBeenCalledWith(100, expect.objectContaining({ status: "rejected" }));
  });

  it("admin_override trail detail contains 'Admin override —' prefix", async () => {
    const caller = makeAdminCaller();
    await caller.audits.decide({ auditId: 100, decision: "admin_override_approved", note: "Exceptional case" });
    expect(vi.mocked(createAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "approved",
        detail: expect.stringContaining("Admin override"),
      })
    );
  });

  it("admin_override trail detail contains the note when provided", async () => {
    const caller = makeAdminCaller();
    await caller.audits.decide({ auditId: 100, decision: "admin_override_rejected", note: "Policy exception" });
    expect(vi.mocked(createAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining("Policy exception") })
    );
  });

  it("admin_override sends email with canonical status (not the override string)", async () => {
    const caller = makeAdminCaller();
    await caller.audits.decide({ auditId: 100, decision: "admin_override_approved" });
    expect(vi.mocked(sendAuditStatusEmails)).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "approved" })
    );
  });
});

describe("audits.reassign — pending-status guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue(MOCK_ADMIN_USER as any);
    vi.mocked(getConsultantNameById).mockResolvedValue({ id: 5, fullName: "Dr New", title: null, active: true } as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined as any);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined as any);
    vi.mocked(createNotification).mockResolvedValue(undefined as any);
    vi.mocked(getUserByLinkedConsultantId).mockResolvedValue(null);
    vi.mocked(sendAuditStatusEmails).mockResolvedValue(undefined as any);
  });

  it("throws BAD_REQUEST when reassigning an already-approved audit", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_APPROVED_AUDIT as any);
    const caller = makeAdminCaller();
    await expect(
      caller.audits.reassign({ auditId: 100, supervisorId: 5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("not pending") });
  });

  it("throws BAD_REQUEST when reassigning an already-rejected audit", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_REJECTED_AUDIT as any);
    const caller = makeAdminCaller();
    await expect(
      caller.audits.reassign({ auditId: 100, supervisorId: 5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("succeeds when the audit is pending", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_PENDING_AUDIT as any);
    const caller = makeAdminCaller();
    const result = await caller.audits.reassign({ auditId: 100, supervisorId: 5 });
    expect(result.success).toBe(true);
  });
});
