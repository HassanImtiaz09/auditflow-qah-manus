/**
 * Round 13 tests:
 * 1. users.updateLinkedConsultant — saves new linkedConsultantId and clears it on null
 * 2. audits.submitDraft — sends audit_assigned (not audit_submitted) notification to consultant
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

vi.mock("./db", () => ({
  // User helpers
  getUserById: vi.fn(),
  getAllUsers: vi.fn(),
  getPendingUsers: vi.fn(),
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  updateUserRole: vi.fn(),
  updateLinkedConsultant: vi.fn(),
  searchUsersByName: vi.fn(),
  updateUserProfile: vi.fn(),
  getUserByEmail: vi.fn(),
  getAdminUsers: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
  getUserByOpenId: vi.fn(),
  // Audit helpers
  getAllAudits: vi.fn(),
  getAuditById: vi.fn(),
  getAuditByRef: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  softDeleteAudit: vi.fn(),
  getAuditsForConsultant: vi.fn(),
  getAuditsForConsultantAll: vi.fn(),
  getMyAudits: vi.fn(),
  getMyDraftAudits: vi.fn(),
  countAudits: vi.fn(),
  getApprovedConsultants: vi.fn(),
  // Notifications
  createNotification: vi.fn(),
  getUnreadNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  // Audit trail
  createAuditEvent: vi.fn(),
  getAuditEvents: vi.fn(),
  // Comments
  createAuditComment: vi.fn(),
  getAuditComments: vi.fn(),
  // Password reset
  createPasswordResetToken: vi.fn(),
  getPasswordResetToken: vi.fn(),
  markPasswordResetTokenUsed: vi.fn(),
  updateUserPassword: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ADMIN_USER = {
  id: 1,
  openId: "admin-1",
  fullName: "Admin User",
  name: "Admin User",
  email: "admin@nhs.uk",
  role: "admin" as const,
  auditRole: "admin" as const,
  approved: true,
  roleApproved: true,
  grade: "Admin",
  title: null,
  linkedConsultantId: null,
  passwordHash: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const CONSULTANT_USER = {
  id: 2,
  openId: "consultant-1",
  fullName: "Dr Jane Smith",
  name: "Dr Jane Smith",
  email: "jane.smith@nhs.uk",
  role: "user" as const,
  auditRole: "consultant" as const,
  approved: true,
  roleApproved: true,
  grade: "Consultant",
  title: "Dr",
  linkedConsultantId: 10,
  passwordHash: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const CLINICIAN_USER = {
  id: 3,
  openId: "clinician-1",
  fullName: "Dr Bob Jones",
  name: "Dr Bob Jones",
  email: "bob.jones@nhs.uk",
  role: "user" as const,
  auditRole: "clinician" as const,
  approved: true,
  roleApproved: true,
  grade: "ST4",
  title: "Dr",
  linkedConsultantId: null,
  passwordHash: null,
  loginMethod: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function makeAudit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 100,
    refNumber: "REF-20260513-0001",
    topic: "Tonsillectomy Audit",
    category: "General ENT",
    clinicalSetting: "Inpatient",
    priority: "Routine" as const,
    status: "draft" as const,
    submittedById: 3,
    submitterName: "Dr Bob Jones",
    submitterEmail: "bob.jones@nhs.uk",
    submitterGrade: "ST4",
    supervisorId: 10,
    supervisorName: "Dr Jane Smith",
    description: "Test audit description",
    collaborators: "[]",
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: null,
    decisionNote: null,
    decidedById: null,
    decidedAt: null,
    reaudit: null,
    dataCollectionPeriod: null,
    expectedSampleSize: null,
    linkedAuditId: null,
    linkedAuditRef: null,
    auditObjectives: "Improve outcomes",
    auditStandards: JSON.stringify([{ standard: "NICE", criteria: "C1", compliance: "100%", exceptions: "" }]),
    dataCollectionMethodDetail: "Case note review",
    reasonForAudit: null,
    reasonForAuditOther: null,
    cqcRegulation: null,
    priorityType: null,
    priorityTypeOther: null,
    supportRequired: null,
    supportRequiredOther: null,
    auditStartDate: null,
    auditEndDate: null,
    whoInvolved: null,
    evidenceBase: null,
    stakeholders: null,
    stakeholdersInformed: false,
    dataSource: null,
    dataSourceOther: null,
    dataCollectionTiming: null,
    dataCollectedBy: null,
    samplingMethodDetail: null,
    dataAnalysisDetail: null,
    dataAnalysedBy: null,
    resultsPresentation: null,
    resultsPresentationOther: null,
    actionPlanOwner: null,
    barriersToChange: null,
    reAuditTimeline: null,
    reAuditTimelineOther: null,
    ...overrides,
  };
}

function makeCtx(user = ADMIN_USER) {
  return { user };
}

// ─── Test Suite 1: users.updateLinkedConsultant ───────────────────────────────

describe("users.updateLinkedConsultant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a new linkedConsultantId for a consultant user", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER);
    vi.mocked(db.updateLinkedConsultant).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(ADMIN_USER));
    const result = await caller.users.updateLinkedConsultant({ userId: 2, linkedConsultantId: 15 });

    expect(result.success).toBe(true);
    expect(db.updateLinkedConsultant).toHaveBeenCalledWith(2, 15);
  });

  it("clears the linkedConsultantId (unlink) when null is passed", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER);
    vi.mocked(db.updateLinkedConsultant).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(ADMIN_USER));
    const result = await caller.users.updateLinkedConsultant({ userId: 2, linkedConsultantId: null });

    expect(result.success).toBe(true);
    expect(db.updateLinkedConsultant).toHaveBeenCalledWith(2, null);
  });

  it("rejects non-admin callers with FORBIDDEN", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    await expect(
      caller.users.updateLinkedConsultant({ userId: 2, linkedConsultantId: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── Test Suite 2: audit_assigned notification type ──────────────────────────

describe("audits.submitDraft — audit_assigned notification type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends an audit_assigned notification to the linked consultant user", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);
    const draftAudit = makeAudit({ status: "draft" });
    vi.mocked(db.getAuditById).mockResolvedValue(draftAudit as ReturnType<typeof makeAudit>);
    vi.mocked(db.updateAudit).mockResolvedValue({ ...draftAudit, status: "pending" } as ReturnType<typeof makeAudit>);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.getAdminUsers).mockResolvedValue([ADMIN_USER]);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(CONSULTANT_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    await caller.audits.submitDraft({ auditId: 100 });

    const notifCalls = vi.mocked(db.createNotification).mock.calls;
    const consultantNotif = notifCalls.find(
      ([n]) => (n as { recipientId: number }).recipientId === CONSULTANT_USER.id
    );
    expect(consultantNotif).toBeDefined();
    const payload = consultantNotif![0] as { type: string; message: string };
    // Must be audit_assigned, not audit_submitted
    expect(payload.type).toBe("audit_assigned");
    expect(payload.message).toContain("REF-20260513-0001");
  });

  it("sends audit_submitted (not audit_assigned) to the admin", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);
    const draftAudit = makeAudit({ status: "draft" });
    vi.mocked(db.getAuditById).mockResolvedValue(draftAudit as ReturnType<typeof makeAudit>);
    vi.mocked(db.updateAudit).mockResolvedValue({ ...draftAudit, status: "pending" } as ReturnType<typeof makeAudit>);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.getAdminUsers).mockResolvedValue([ADMIN_USER]);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(CONSULTANT_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    await caller.audits.submitDraft({ auditId: 100 });

    const notifCalls = vi.mocked(db.createNotification).mock.calls;
    const adminNotif = notifCalls.find(
      ([n]) => (n as { recipientId: number }).recipientId === ADMIN_USER.id
    );
    expect(adminNotif).toBeDefined();
    const payload = adminNotif![0] as { type: string };
    expect(payload.type).toBe("audit_submitted");
  });
});
