/**
 * supervisor-scoping.test.ts
 *
 * Pins four invariants around the supervisorId / linkedConsultantId / users.id
 * relationship described in the SUPERVISOR ID INVARIANTS block in routers.ts.
 *
 * Invariants under test:
 *  1. Submitting an audit denormalises the supervisor's display name from
 *     consultantNames (title + fullName), NOT from the users table.
 *  2. An assigned consultant (linkedConsultantId === audit.supervisorId) CAN
 *     read and post comments on the audit.
 *  3. A non-assigned consultant (different linkedConsultantId) CANNOT read or
 *     post comments.
 *  4. After reassign, the new supervisor's user account (looked up via
 *     getUserByLinkedConsultantId) receives the in-app notification.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock the db module ────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getConsultantNameById: vi.fn(),
  getUserByLinkedConsultantId: vi.fn(),
  getAuditById: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  countAudits: vi.fn(),
  createAuditEvent: vi.fn(),
  createAuditComment: vi.fn(),
  getAuditComments: vi.fn(),
  createNotification: vi.fn(),
  getAdminUser: vi.fn(),
  getAllAudits: vi.fn(),
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

// ─── Shared fixtures ───────────────────────────────────────────────────────────

/** consultantNames row for "Mr. Costa Repanos" — id=7 */
const MOCK_CONSULTANT_NAME = {
  id: 7,
  title: "Mr.",
  fullName: "Costa Repanos",
  grade: "Consultant - Head and Neck",
  active: true,
  createdAt: new Date(),
};

/** User account for the assigned consultant — linkedConsultantId=7 */
const MOCK_ASSIGNED_CONSULTANT_USER = {
  id: 42,
  openId: "consultant-assigned",
  name: "Costa Repanos",
  fullName: "Mr. Costa Repanos",
  email: "c.repanos@porthosp.nhs.uk",
  auditRole: "consultant" as const,
  role: "user" as const,
  approved: true,
  roleApproved: true,
  linkedConsultantId: 7,
  emailVerified: true,
  emailVerifyToken: null,
  emailVerifyTokenExpiresAt: null,
  grade: "Consultant",
  title: "Mr.",
  passwordHash: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
};

/** User account for a different consultant — linkedConsultantId=99 (not assigned) */
const MOCK_OTHER_CONSULTANT_USER = {
  ...MOCK_ASSIGNED_CONSULTANT_USER,
  id: 55,
  openId: "consultant-other",
  name: "Erik Nilssen",
  fullName: "Mr. Erik Nilssen",
  email: "e.nilssen@porthosp.nhs.uk",
  linkedConsultantId: 99,
};

/** Clinician who submitted the audit */
const MOCK_CLINICIAN_USER = {
  id: 10,
  openId: "clinician-1",
  name: "Dr. Smith",
  fullName: "Dr. Smith",
  email: "smith@porthosp.nhs.uk",
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
};

/** Admin user */
const MOCK_ADMIN_USER = {
  ...MOCK_CLINICIAN_USER,
  id: 1,
  openId: "admin-1",
  name: "Admin",
  fullName: "Admin",
  email: "admin@porthosp.nhs.uk",
  auditRole: "admin" as const,
  role: "admin" as const,
  linkedConsultantId: null,
};

/** Pending audit assigned to consultantNames.id=7 */
const MOCK_AUDIT = {
  id: 100,
  refNumber: "REF-20260514-0001",
  topic: "ENT Audit",
  status: "pending" as const,
  supervisorId: 7,          // consultantNames.id — NOT users.id
  supervisorName: "Mr. Costa Repanos",
  submittedById: 10,
  submitterName: "Dr. Smith",
  submitterEmail: "smith@porthosp.nhs.uk",
  archived: false,
  collaborators: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Helper to build a caller with a given user context ───────────────────────

function callerFor(user: typeof MOCK_CLINICIAN_USER) {
  return appRouter.createCaller({
    user: { id: user.id, openId: user.openId },
    req: {} as never,
    res: {} as never,
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Supervisor scoping — invariant 1: submit denormalises name from consultantNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === MOCK_CLINICIAN_USER.id) return MOCK_CLINICIAN_USER as never;
      if (id === MOCK_ADMIN_USER.id) return MOCK_ADMIN_USER as never;
      return undefined;
    });
    vi.mocked(db.getConsultantNameById).mockResolvedValue(MOCK_CONSULTANT_NAME as never);
    vi.mocked(db.countAudits).mockResolvedValue(0);
    vi.mocked(db.createAudit).mockResolvedValue({ ...MOCK_AUDIT, id: 200 } as never);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.getAdminUser).mockResolvedValue(MOCK_ADMIN_USER as never);
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(MOCK_ASSIGNED_CONSULTANT_USER as never);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
  });

  it("uses title + fullName from consultantNames row for supervisorName, not from users", async () => {
    const caller = callerFor(MOCK_CLINICIAN_USER);
    await caller.audits.submit({
      topic: "ENT Audit",
      category: "ENT",
      clinicalSetting: "Outpatient",
      priority: "Routine",
      description: "Test audit",
      supervisorId: 7,
      isDraft: false,
      auditObjectives: "To assess compliance with ENT protocols.",
      auditStandards: JSON.stringify([{ standard: "NICE NG98", criteria: "All patients", compliance: "90%", exceptions: "" }]),
      dataCollectionMethodDetail: "Retrospective review of patient records.",
    } as never);

    // getConsultantNameById must have been called with the supervisorId
    expect(db.getConsultantNameById).toHaveBeenCalledWith(7);

    // createAudit must have been called with the denormalised name from the roster
    const createAuditCall = vi.mocked(db.createAudit).mock.calls[0][0];
    expect(createAuditCall.supervisorName).toBe("Mr. Costa Repanos");

    // getUserById must NOT have been called with supervisorId=7 for name resolution
    const getUserByIdCalls = vi.mocked(db.getUserById).mock.calls.map((c) => c[0]);
    expect(getUserByIdCalls).not.toContain(7);
  });
});

describe("Supervisor scoping — invariant 2: assigned consultant CAN read and post comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === MOCK_ASSIGNED_CONSULTANT_USER.id) return MOCK_ASSIGNED_CONSULTANT_USER as never;
      return undefined;
    });
    vi.mocked(db.getAuditById).mockResolvedValue(MOCK_AUDIT as never);
    vi.mocked(db.getAuditComments).mockResolvedValue([]);
    vi.mocked(db.createAuditComment).mockResolvedValue({ id: 1, body: "Hello" } as never);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
  });

  it("allows the assigned consultant to read comments", async () => {
    const caller = callerFor(MOCK_ASSIGNED_CONSULTANT_USER);
    // Should not throw
    await expect(caller.audits.comments({ auditId: 100 })).resolves.toBeDefined();
  });

  it("allows the assigned consultant to post a comment", async () => {
    const caller = callerFor(MOCK_ASSIGNED_CONSULTANT_USER);
    await expect(
      caller.audits.addComment({ auditId: 100, body: "Looks good." })
    ).resolves.toBeDefined();
  });
});

describe("Supervisor scoping — invariant 3: non-assigned consultant CANNOT read or post comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === MOCK_OTHER_CONSULTANT_USER.id) return MOCK_OTHER_CONSULTANT_USER as never;
      return undefined;
    });
    vi.mocked(db.getAuditById).mockResolvedValue(MOCK_AUDIT as never);
  });

  it("blocks a non-assigned consultant from reading comments", async () => {
    const caller = callerFor(MOCK_OTHER_CONSULTANT_USER);
    await expect(caller.audits.comments({ auditId: 100 })).rejects.toThrow(TRPCError);
  });

  it("blocks a non-assigned consultant from posting a comment", async () => {
    const caller = callerFor(MOCK_OTHER_CONSULTANT_USER);
    await expect(
      caller.audits.addComment({ auditId: 100, body: "I should not be here." })
    ).rejects.toThrow(TRPCError);
  });
});

describe("Supervisor scoping — invariant 4: reassign sends in-app notification to new supervisor's user account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserById).mockImplementation(async (id) => {
      if (id === MOCK_ADMIN_USER.id) return MOCK_ADMIN_USER as never;
      return undefined;
    });
    vi.mocked(db.getConsultantNameById).mockResolvedValue(MOCK_CONSULTANT_NAME as never);
    vi.mocked(db.getAuditById).mockResolvedValue(MOCK_AUDIT as never);
    vi.mocked(db.updateAudit).mockResolvedValue(MOCK_AUDIT as never);
    vi.mocked(db.createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(db.createNotification).mockResolvedValue(undefined);
    // getUserByLinkedConsultantId returns the consultant user account for id=7
    vi.mocked(db.getUserByLinkedConsultantId).mockImplementation(async (linkedId) => {
      if (linkedId === 7) return MOCK_ASSIGNED_CONSULTANT_USER as never;
      return undefined;
    });
  });

  it("sends the in-app notification to the user account found via getUserByLinkedConsultantId", async () => {
    const caller = callerFor(MOCK_ADMIN_USER);
    await caller.audits.reassign({ auditId: 100, supervisorId: 7 });

    // getUserByLinkedConsultantId must have been called with the consultantNames.id
    expect(db.getUserByLinkedConsultantId).toHaveBeenCalledWith(7);

    // createNotification must have been called with the consultant's users.id (42), not consultantNames.id (7)
    const notifCall = vi.mocked(db.createNotification).mock.calls[0]?.[0];
    expect(notifCall).toBeDefined();
    expect(notifCall?.recipientId).toBe(MOCK_ASSIGNED_CONSULTANT_USER.id); // 42
    expect(notifCall?.recipientId).not.toBe(7); // must NOT be the consultantNames.id
  });

  it("skips the in-app notification when no user account is linked to the new supervisor", async () => {
    vi.mocked(db.getUserByLinkedConsultantId).mockResolvedValue(undefined);
    const caller = callerFor(MOCK_ADMIN_USER);
    await caller.audits.reassign({ auditId: 100, supervisorId: 7 });

    // createNotification should not have been called
    expect(db.createNotification).not.toHaveBeenCalled();
  });
});
