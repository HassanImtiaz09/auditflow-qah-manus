/**
 * registry-access.test.ts
 *
 * Pins the access-control invariants introduced in Tranche A Prompt 5:
 *
 *  1. audits.list throws FORBIDDEN for a non-admin clinician.
 *  2. audits.listWithHistory throws FORBIDDEN for a non-admin clinician.
 *  3. audits.history throws FORBIDDEN for a random clinician who is neither
 *     the submitter nor the assigned supervisor.
 *  4. audits.history is allowed for the submitter.
 *  5. audits.history is allowed for the assigned consultant (linkedConsultantId match).
 *  6. audits.history is allowed for an admin.
 *  7. audits.myAuditsRegistry returns only audits the user is involved in
 *     (submitter, collaborator, or assigned supervisor).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock the db module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getConsultantNameById: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
  getAuditById: vi.fn(),
  getAuditEvents: vi.fn(),
  getAllAudits: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  countAudits: vi.fn(),
  createAuditEvent: vi.fn(),
  createAuditComment: vi.fn(),
  getAuditComments: vi.fn(),
  createNotification: vi.fn(),
  getAdminUsers: vi.fn(),
  getConsultantNames: vi.fn(),
  getMyAudits: vi.fn(),
  getMyDraftAudits: vi.fn(),
  getAuditsForConsultant: vi.fn(),
  getAuditsForConsultantAll: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  getAllUsers: vi.fn(),
  getPendingUsers: vi.fn(),
  getApprovedConsultants: vi.fn(),
  getAdminOverviewStats: vi.fn(),
  getAuditsPerConsultant: vi.fn(),
  getApproachingDeadlines: vi.fn(),
  getRecentRegistrations: vi.fn(),
  getUnreadNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  searchUsersByName: vi.fn(),
  updateUserRole: vi.fn(),
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  upsertUser: vi.fn(),
  updateLinkedConsultant: vi.fn(),
  addConsultantName: vi.fn(),
  updateAudit: vi.fn(),
  deleteAudit: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserPassword: vi.fn(),
  createPasswordResetToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
  markPasswordResetTokenUsed: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserByEmailVerifyToken: vi.fn(),
  setEmailVerifyToken: vi.fn(),
  markEmailVerified: vi.fn(),
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_USER = {
  openId: "test-open-id",
  name: "Test User",
  fullName: "Test User",
  title: null,
  email: "test@nhs.net",
  grade: "ST3",
  approved: true,
  roleApproved: true,
  emailVerified: true,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ADMIN_USER = {
  ...BASE_USER,
  id: 1,
  openId: "admin-open-id",
  email: "admin@nhs.net",
  auditRole: "admin" as const,
  role: "admin" as const,
  linkedConsultantId: null,
};

const CLINICIAN_USER = {
  ...BASE_USER,
  id: 10,
  openId: "clinician-open-id",
  email: "clinician@nhs.net",
  auditRole: "clinician" as const,
  role: "user" as const,
  linkedConsultantId: null,
};

const SUBMITTER_USER = {
  ...BASE_USER,
  id: 20,
  openId: "submitter-open-id",
  email: "submitter@nhs.net",
  auditRole: "clinician" as const,
  role: "user" as const,
  linkedConsultantId: null,
};

const CONSULTANT_USER = {
  ...BASE_USER,
  id: 30,
  openId: "consultant-open-id",
  email: "consultant@nhs.net",
  auditRole: "consultant" as const,
  role: "user" as const,
  linkedConsultantId: 7, // linked to consultantNames.id = 7
};

const MOCK_AUDIT = {
  id: 100,
  refNumber: "REF-20250101-0001",
  status: "pending" as const,
  archived: false,
  submittedById: 20, // SUBMITTER_USER.id
  submitterName: "Test Submitter",
  submitterEmail: "submitter@nhs.net",
  submitterGrade: "ST3",
  supervisorId: 7, // consultantNames.id — matches CONSULTANT_USER.linkedConsultantId
  supervisorName: "Mr. Costa Repanos",
  category: "Otology",
  clinicalSetting: "Outpatient",
  priority: "Routine",
  topic: "Test Audit",
  description: "Test description",
  collaborators: JSON.stringify([{ name: "Collab One", email: "collab@nhs.net" }]),
  reaudit: "No",
  expectedSampleSize: "50",
  dataCollectionPeriod: "Jan–Mar 2025",
  submittedAt: new Date(),
  decidedAt: null,
  decisionNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  auditObjectives: "Test objectives",
  auditStandards: "[]",
  dataSource: "[]",
  dataCollectionMethodDetail: "Test method",
  reasonForAudit: "[]",
  supportRequired: "[]",
  resultsPresentation: "[]",
};

/** Helper: build a caller context for a given user */
function callerFor(user: typeof ADMIN_USER) {
  return appRouter.createCaller({
    user: { id: user.id, openId: user.openId },
    req: {} as any,
    res: {} as any,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("audits.list — admin-only guard", () => {
  it("throws FORBIDDEN for a non-admin clinician", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER as any);
    vi.mocked(db.getAllAudits).mockResolvedValue([]);
    const caller = callerFor(CLINICIAN_USER);
    await expect(caller.audits.list()).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("returns audits for an admin", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER as any);
    vi.mocked(db.getAllAudits).mockResolvedValue([MOCK_AUDIT as any]);
    const caller = callerFor(ADMIN_USER);
    const result = await caller.audits.list();
    expect(result).toHaveLength(1);
  });
});

describe("audits.listWithHistory — admin-only guard", () => {
  it("throws FORBIDDEN for a non-admin clinician", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER as any);
    const caller = callerFor(CLINICIAN_USER);
    await expect(caller.audits.listWithHistory()).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("returns audits with history for an admin", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER as any);
    vi.mocked(db.getAllAudits).mockResolvedValue([MOCK_AUDIT as any]);
    vi.mocked(db.getAuditEvents).mockResolvedValue([]);
    const caller = callerFor(ADMIN_USER);
    const result = await caller.audits.listWithHistory();
    expect(result).toHaveLength(1);
    expect(result[0].history).toEqual([]);
  });
});

describe("audits.history — ACL", () => {
  beforeEach(() => {
    vi.mocked(db.getAuditById).mockResolvedValue(MOCK_AUDIT as any);
    vi.mocked(db.getAuditEvents).mockResolvedValue([]);
  });

  it("throws FORBIDDEN for a random clinician (not submitter, not supervisor)", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER as any);
    const caller = callerFor(CLINICIAN_USER);
    await expect(caller.audits.history({ auditId: 100 })).rejects.toThrow(
      expect.objectContaining({ code: "FORBIDDEN" })
    );
  });

  it("allows the submitter to view history", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(SUBMITTER_USER as any);
    const caller = callerFor(SUBMITTER_USER);
    const result = await caller.audits.history({ auditId: 100 });
    expect(result).toEqual([]);
  });

  it("allows the assigned consultant (linkedConsultantId match) to view history", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CONSULTANT_USER as any);
    const caller = callerFor(CONSULTANT_USER);
    const result = await caller.audits.history({ auditId: 100 });
    expect(result).toEqual([]);
  });

  it("allows an admin to view history", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER as any);
    const caller = callerFor(ADMIN_USER);
    const result = await caller.audits.history({ auditId: 100 });
    expect(result).toEqual([]);
  });
});

describe("audits.myAuditsRegistry — scoped view", () => {
  const COLLAB_USER = {
    ...BASE_USER,
    id: 40,
    openId: "collab-open-id",
    email: "collab@nhs.net", // matches the collaborator email in MOCK_AUDIT
    auditRole: "clinician" as const,
    role: "user" as const,
    linkedConsultantId: null,
  };

  const UNRELATED_USER = {
    ...BASE_USER,
    id: 50,
    openId: "unrelated-open-id",
    email: "unrelated@nhs.net",
    auditRole: "clinician" as const,
    role: "user" as const,
    linkedConsultantId: null,
  };

  beforeEach(() => {
    vi.mocked(db.getAllAudits).mockResolvedValue([MOCK_AUDIT as any]);
  });

  it("returns the audit for the submitter", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(SUBMITTER_USER as any);
    const caller = callerFor(SUBMITTER_USER);
    const result = await caller.audits.myAuditsRegistry();
    expect(result).toHaveLength(1);
  });

  it("returns the audit for the assigned consultant", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CONSULTANT_USER as any);
    const caller = callerFor(CONSULTANT_USER);
    const result = await caller.audits.myAuditsRegistry();
    expect(result).toHaveLength(1);
  });

  it("returns the audit for a listed collaborator", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(COLLAB_USER as any);
    const caller = callerFor(COLLAB_USER);
    const result = await caller.audits.myAuditsRegistry();
    expect(result).toHaveLength(1);
  });

  it("returns empty for an unrelated clinician", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(UNRELATED_USER as any);
    const caller = callerFor(UNRELATED_USER);
    const result = await caller.audits.myAuditsRegistry();
    expect(result).toHaveLength(0);
  });

  it("returns all audits for an admin", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER as any);
    const caller = callerFor(ADMIN_USER);
    const result = await caller.audits.myAuditsRegistry();
    expect(result).toHaveLength(1);
  });
});
