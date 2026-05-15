/**
 * Round 12 tests:
 * 1. users.approve — saves linkedConsultantId when provided
 * 2. audits.myConsultantQueue — returns pending/approved/rejected grouped correctly
 * 3. audits.submitDraft — sends in-app notification to the linked consultant user
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
  searchUsersByName: vi.fn(),
  updateUserProfile: vi.fn(),
  getUserByEmail: vi.fn(),
  getAdminUsers: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
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

// ─── Shared fixtures ──────────────────────────────────────────────────────────

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
  linkedConsultantId: 10, // linked to seeded consultant id=10
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
    status: "pending" as const,
    submittedById: 3,
    submitterName: "Dr Bob Jones",
    submitterEmail: "bob.jones@nhs.uk",
    submitterGrade: "ST4",
    supervisorId: 10, // seeded consultant id
    supervisorName: "Dr Jane Smith",
    description: "Test audit description",
    collaborators: "[]",
    isDraft: false,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: new Date(),
    decisionNote: null,
    decidedById: null,
    decidedAt: null,
    reaudit: null,
    dataCollectionPeriod: null,
    expectedSampleSize: null,
    linkedAuditId: null,
    linkedAuditRef: null,
    auditObjectives: "Improve outcomes",
    auditStandards: JSON.stringify([{ standard: "NICE", criteria: "Criteria 1", compliance: "100%", exceptions: "" }]),
    dataCollectionMethodDetail: "Retrospective case note review",
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

// ─── Test Suite 1: users.approve with linkedConsultantId ─────────────────────

describe("users.approve — linkedConsultantId linking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls approveUser with linkedConsultantId when provided", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER);
    vi.mocked(db.approveUser).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(ADMIN_USER));
    const result = await caller.users.approve({ userId: 2, linkedConsultantId: 10 });

    expect(result.success).toBe(true);
    expect(db.approveUser).toHaveBeenCalledWith(2, 10);
  });

  it("calls approveUser without linkedConsultantId for non-consultant accounts", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(ADMIN_USER);
    vi.mocked(db.approveUser).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(ADMIN_USER));
    const result = await caller.users.approve({ userId: 3 });

    expect(result.success).toBe(true);
    expect(db.approveUser).toHaveBeenCalledWith(3, undefined);
  });

  it("rejects non-admin callers with FORBIDDEN", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    await expect(caller.users.approve({ userId: 2 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

// ─── Test Suite 2: audits.myConsultantQueue ───────────────────────────────────

describe("audits.myConsultantQueue — grouped by status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pending/approved/rejected grouped for a consultant using linkedConsultantId", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CONSULTANT_USER);
    const pendingAudit = makeAudit({ id: 1, status: "pending" });
    const approvedAudit = makeAudit({ id: 2, status: "approved" });
    const rejectedAudit = makeAudit({ id: 3, status: "rejected" });
    vi.mocked(db.getAuditsForConsultantAll).mockResolvedValue([
      pendingAudit,
      approvedAudit,
      rejectedAudit,
    ] as ReturnType<typeof makeAudit>[]);

    const caller = appRouter.createCaller(makeCtx(CONSULTANT_USER));
    const result = await caller.audits.myConsultantQueue();

    // Should use linkedConsultantId=10 for the lookup
    expect(db.getAuditsForConsultantAll).toHaveBeenCalledWith(CONSULTANT_USER.linkedConsultantId);
    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.pending[0].id).toBe(1);
    expect(result.approved[0].id).toBe(2);
    expect(result.rejected[0].id).toBe(3);
  });

  it("returns empty groups for a clinician (non-consultant)", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    const result = await caller.audits.myConsultantQueue();

    expect(result.pending).toHaveLength(0);
    expect(result.approved).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(db.getAuditsForConsultantAll).not.toHaveBeenCalled();
  });

  it("excludes draft audits from the queue", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CONSULTANT_USER);
    // getAuditsForConsultantAll already filters out drafts at DB level; simulate that
    vi.mocked(db.getAuditsForConsultantAll).mockResolvedValue([
      makeAudit({ id: 1, status: "pending" }),
    ] as ReturnType<typeof makeAudit>[]);

    const caller = appRouter.createCaller(makeCtx(CONSULTANT_USER));
    const result = await caller.audits.myConsultantQueue();

    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

// ─── Test Suite 3: audits.submitDraft — consultant notification ───────────────

describe("audits.submitDraft — consultant in-app notification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a notification to the linked consultant user when supervisorId is set", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);
    const draftAudit = makeAudit({
      id: 100,
      status: "draft",
      submittedById: 3,
      supervisorId: 10,
      supervisorName: "Dr Jane Smith",
      auditObjectives: "Improve outcomes",
      auditStandards: JSON.stringify([{ standard: "NICE", criteria: "C1", compliance: "100%", exceptions: "" }]),
      dataCollectionMethodDetail: "Case note review",
    });
    vi.mocked(db.getAuditById).mockResolvedValue(draftAudit as ReturnType<typeof makeAudit>);
    vi.mocked(db.updateAudit).mockResolvedValue({ ...draftAudit, status: "pending" } as ReturnType<typeof makeAudit>);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.getAdminUsers).mockResolvedValue([ADMIN_USER]);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    // The linked consultant user account
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(CONSULTANT_USER);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    const result = await caller.audits.submitDraft({ auditId: 100 });

    expect(result.success).toBe(true);
    // Should have called getUserByLinkedConsultantId with supervisorId=10
    expect(db.getUserByLinkedConsultantId).toHaveBeenCalledWith(10);
    // Should have created a notification for the consultant user (id=2)
    const notifCalls = vi.mocked(db.createNotification).mock.calls;
    const consultantNotif = notifCalls.find(
      ([n]) => (n as { recipientId: number }).recipientId === CONSULTANT_USER.id
    );
    expect(consultantNotif).toBeDefined();
    const notifPayload = consultantNotif![0] as { type: string; message: string };
    expect(notifPayload.type).toBe("audit_assigned");
    expect(notifPayload.message).toContain("REF-20260513-0001");
  });

  it("does not send a consultant notification when no supervisorId is set", async () => {
    vi.mocked(db.getUserById).mockResolvedValue(CLINICIAN_USER);
    const draftAudit = makeAudit({
      id: 101,
      status: "draft",
      submittedById: 3,
      supervisorId: null,
      auditObjectives: "Improve outcomes",
      auditStandards: JSON.stringify([{ standard: "NICE", criteria: "C1", compliance: "100%", exceptions: "" }]),
      dataCollectionMethodDetail: "Case note review",
    });
    vi.mocked(db.getAuditById).mockResolvedValue(draftAudit as ReturnType<typeof makeAudit>);
    vi.mocked(db.updateAudit).mockResolvedValue({ ...draftAudit, status: "pending" } as ReturnType<typeof makeAudit>);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.getAdminUsers).mockResolvedValue([ADMIN_USER]);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(CLINICIAN_USER));
    await caller.audits.submitDraft({ auditId: 101 });

    expect(db.getUserByLinkedConsultantId).not.toHaveBeenCalled();
    // Only admin notification should have been sent (one per admin)
    const notifCalls = vi.mocked(db.createNotification).mock.calls;
    expect(notifCalls.length).toBeGreaterThanOrEqual(1);
    const adminNotif = notifCalls.find(([n]) => (n as { recipientId: number }).recipientId === ADMIN_USER.id);
    expect(adminNotif).toBeDefined();
  });
});
