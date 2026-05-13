/**
 * Tests for draft management procedures:
 * audits.getDraft, audits.updateDraft, audits.deleteDraft, audits.submitDraft
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getAuditById: vi.fn(),
  updateAudit: vi.fn(),
  deleteAudit: vi.fn(),
  getMyAudits: vi.fn(),
  getMyDraftAudits: vi.fn(),
  getAllAudits: vi.fn(),
  getAuditByRef: vi.fn(),
  getAuditsForConsultant: vi.fn(),
  getUserById: vi.fn(),
  getAdminUser: vi.fn(),
  getApprovedConsultants: vi.fn(),
  createAuditEvent: vi.fn(),
  getAuditEvents: vi.fn(),
  createNotification: vi.fn(),
  createAuditComment: vi.fn(),
  getAuditComments: vi.fn(),
  updateUserProfile: vi.fn(),
}));

import {
  getAuditById,
  updateAudit,
  deleteAudit,
  getUserById,
  getAdminUser,
  createAuditEvent,
  createNotification,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OWNER_ID = 10;
const OTHER_ID = 99;

const MOCK_DRAFT = {
  id: 1,
  refNumber: "REF-20250101-0001",
  status: "draft" as const,
  submittedById: OWNER_ID,
  submitterName: "Dr Owner",
  submitterEmail: "owner@nhs.uk",
  submitterGrade: "SHO / CT",
  topic: "Draft Audit Title",
  category: "Otology",
  clinicalSetting: "Outpatient clinic",
  priority: "Routine" as const,
  reaudit: "No",
  description: "A draft description.",
  supervisorId: null,
  supervisorName: null,
  collaborators: "[]",
  reasonForAudit: "[]",
  supportRequired: "[]",
  dataSource: "[]",
  resultsPresentation: "[]",
  auditStandards: JSON.stringify([{ standard: "NICE CG123", criteria: "All patients", compliance: "95%", exceptions: "" }]),
  dataCollectionPeriod: null,
  expectedSampleSize: null,
  auditObjectives: "To assess compliance with NICE guidance on tonsillectomy.",
  whoInvolved: null,
  evidenceBase: null,
  stakeholders: null,
  stakeholdersInformed: false,
  dataCollectionMethodDetail: "Retrospective review of clinical notes.",
  dataCollectionTiming: null,
  dataCollectedBy: null,
  samplingMethodDetail: null,
  dataAnalysisDetail: null,
  dataAnalysedBy: null,
  actionPlanOwner: null,
  barriersToChange: null,
  reAuditTimeline: null,
  reAuditTimelineOther: null,
  cqcRegulation: null,
  priorityType: null,
  priorityTypeOther: null,
  reasonForAuditOther: null,
  supportRequiredOther: null,
  dataSourceOther: null,
  resultsPresentationOther: null,
  auditStartDate: null,
  auditEndDate: null,
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_ACTOR = { id: OWNER_ID, fullName: "Dr Owner", name: "Dr Owner", role: "user" as const, auditRole: "clinician" as const };

const makeCtx = (userId: number) => ({
  user: { id: userId, name: "Test", role: "user" as const, auditRole: "clinician" as const },
});


// ─── getDraft ─────────────────────────────────────────────────────────────────

describe("audits.getDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the draft when owner requests it", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    const result = await caller.audits.getDraft({ auditId: 1 });
    expect(result.id).toBe(1);
    expect(result.topic).toBe("Draft Audit Title");
    expect(Array.isArray(result.collaborators)).toBe(true);
  });

  it("throws NOT_FOUND when audit does not exist", async () => {
    vi.mocked(getAuditById).mockResolvedValue(null as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.getDraft({ auditId: 999 })).rejects.toThrow(TRPCError);
  });

  it("throws FORBIDDEN when a different user requests it", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    const caller = appRouter.createCaller(makeCtx(OTHER_ID) as any);
    await expect(caller.audits.getDraft({ auditId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws BAD_REQUEST when audit is not a draft", async () => {
    vi.mocked(getAuditById).mockResolvedValue({ ...MOCK_DRAFT, status: "pending" } as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.getDraft({ auditId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── updateDraft ──────────────────────────────────────────────────────────────

describe("audits.updateDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a draft and records a draft_saved event", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    vi.mocked(getUserById).mockResolvedValue(MOCK_ACTOR as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    const result = await caller.audits.updateDraft({
      auditId: 1,
      topic: "Updated Title",
      description: "Updated description.",
    });

    expect(result.success).toBe(true);
    expect(updateAudit).toHaveBeenCalledWith(1, expect.objectContaining({ topic: "Updated Title" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "draft_saved" }));
  });

  it("throws FORBIDDEN when non-owner tries to update", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    const caller = appRouter.createCaller(makeCtx(OTHER_ID) as any);
    await expect(caller.audits.updateDraft({ auditId: 1, topic: "Hack" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws BAD_REQUEST when audit is not a draft", async () => {
    vi.mocked(getAuditById).mockResolvedValue({ ...MOCK_DRAFT, status: "pending" } as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.updateDraft({ auditId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── deleteDraft ──────────────────────────────────────────────────────────────

describe("audits.deleteDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a draft owned by the current user", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    vi.mocked(deleteAudit).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    const result = await caller.audits.deleteDraft({ auditId: 1 });
    expect(result.success).toBe(true);
    expect(deleteAudit).toHaveBeenCalledWith(1);
  });

  it("throws FORBIDDEN when non-owner tries to delete", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    const caller = appRouter.createCaller(makeCtx(OTHER_ID) as any);
    await expect(caller.audits.deleteDraft({ auditId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws BAD_REQUEST when audit is not a draft", async () => {
    vi.mocked(getAuditById).mockResolvedValue({ ...MOCK_DRAFT, status: "pending" } as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.deleteDraft({ auditId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── submitDraft ──────────────────────────────────────────────────────────────

describe("audits.submitDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes a draft to pending and records a submitted event", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    vi.mocked(getUserById).mockResolvedValue(MOCK_ACTOR as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(getAdminUser).mockResolvedValue(null as any);

    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    const result = await caller.audits.submitDraft({ auditId: 1 });
    expect(result.success).toBe(true);
    expect(result.refNumber).toBe("REF-20250101-0001");
    expect(updateAudit).toHaveBeenCalledWith(1, expect.objectContaining({ status: "pending" }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "submitted" }));
  });

  it("throws BAD_REQUEST when draft has no title", async () => {
    vi.mocked(getAuditById).mockResolvedValue({ ...MOCK_DRAFT, topic: "" } as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.submitDraft({ auditId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws FORBIDDEN when non-owner tries to submit", async () => {
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    const caller = appRouter.createCaller(makeCtx(OTHER_ID) as any);
    await expect(caller.audits.submitDraft({ auditId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("notifies admin when admin exists", async () => {
    const ADMIN = { id: 5, fullName: "Admin User", name: "Admin", role: "admin" as const, auditRole: "admin" as const };
    vi.mocked(getAuditById).mockResolvedValue(MOCK_DRAFT as any);
    vi.mocked(getUserById).mockResolvedValue(MOCK_ACTOR as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(getAdminUser).mockResolvedValue(ADMIN as any);
    vi.mocked(createNotification).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await caller.audits.submitDraft({ auditId: 1 });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "audit_submitted" }));
  });

  // ── Step 2 field validation ──

  it("throws BAD_REQUEST when auditObjectives is blank", async () => {
    const draftWithObjectives = {
      ...MOCK_DRAFT,
      auditObjectives: "",
      auditStandards: JSON.stringify([{ standard: "NICE CG123", criteria: "All patients", compliance: "95%", exceptions: "" }]),
      dataCollectionMethodDetail: "Retrospective notes review",
    };
    vi.mocked(getAuditById).mockResolvedValue(draftWithObjectives as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.submitDraft({ auditId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Audit Objectives"),
    });
  });

  it("throws BAD_REQUEST when auditStandards is an empty array", async () => {
    const draftNoStandards = {
      ...MOCK_DRAFT,
      auditObjectives: "To assess compliance with NICE guidance.",
      auditStandards: JSON.stringify([]),
      dataCollectionMethodDetail: "Retrospective notes review",
    };
    vi.mocked(getAuditById).mockResolvedValue(draftNoStandards as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.submitDraft({ auditId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Audit Standards"),
    });
  });

  it("throws BAD_REQUEST when dataCollectionMethodDetail is blank", async () => {
    const draftNoMethod = {
      ...MOCK_DRAFT,
      auditObjectives: "To assess compliance with NICE guidance.",
      auditStandards: JSON.stringify([{ standard: "NICE CG123", criteria: "All patients", compliance: "95%", exceptions: "" }]),
      dataCollectionMethodDetail: "",
    };
    vi.mocked(getAuditById).mockResolvedValue(draftNoMethod as any);
    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    await expect(caller.audits.submitDraft({ auditId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Data Collection Method"),
    });
  });

  it("passes validation when all required Step 2 fields are present", async () => {
    const completeDraft = {
      ...MOCK_DRAFT,
      auditObjectives: "To assess compliance with NICE guidance.",
      auditStandards: JSON.stringify([{ standard: "NICE CG123", criteria: "All patients", compliance: "95%", exceptions: "" }]),
      dataCollectionMethodDetail: "Retrospective notes review",
    };
    vi.mocked(getAuditById).mockResolvedValue(completeDraft as any);
    vi.mocked(getUserById).mockResolvedValue(MOCK_ACTOR as any);
    vi.mocked(updateAudit).mockResolvedValue(undefined);
    vi.mocked(createAuditEvent).mockResolvedValue(undefined);
    vi.mocked(getAdminUser).mockResolvedValue(null as any);

    const caller = appRouter.createCaller(makeCtx(OWNER_ID) as any);
    const result = await caller.audits.submitDraft({ auditId: 1 });
    expect(result.success).toBe(true);
  });
});
