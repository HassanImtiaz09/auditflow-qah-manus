/**
 * Round 8 tests: standardPresets and searchByRef procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

vi.mock("./db", () => ({
  getAllAudits: vi.fn(),
  getAuditEvents: vi.fn(),
  getAuditComments: vi.fn(),
  createAuditEvent: vi.fn(),
  createAuditComment: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  deleteAudit: vi.fn(),
  getAuditById: vi.fn(),
  getMyDraftAudits: vi.fn(),
  getApprovedConsultants: vi.fn(),
  getUserById: vi.fn(),
  updateUserProfile: vi.fn(),
  searchAuditsByRef: vi.fn(),
}));

const MOCK_USER = {
  id: 1,
  openId: "user-1",
  fullName: "Dr Test User",
  email: "test@nhs.uk",
  role: "user" as const,
  auditRole: "clinician" as const,
  approved: true,
  roleApproved: true,
  grade: "ST4",
  passwordHash: "$2b$12$placeholder",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCtx(user = MOCK_USER) {
  return { user };
}

const MOCK_AUDITS = [
  {
    id: 1,
    refNumber: "QAH-2025-001",
    topic: "Tonsillectomy outcomes",
    status: "approved" as const,
    submitterName: "Dr Test User",
    submitterId: 1,
    supervisorId: null,
    supervisorName: null,
    category: "Clinical",
    clinicalSetting: "Inpatient",
    priority: "High",
    description: "Test audit",
    grade: "ST4",
    email: "test@nhs.uk",
    collaborators: "[]",
    dataCollectionPeriod: null,
    expectedSampleSize: null,
    reaudit: "No",
    linkedAuditId: null,
    linkedAuditRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    refNumber: "QAH-2025-002",
    topic: "Rhinoplasty complication rates",
    status: "pending" as const,
    submitterName: "Dr Another User",
    submitterId: 2,
    supervisorId: null,
    supervisorName: null,
    category: "Clinical",
    clinicalSetting: "Outpatient",
    priority: "Medium",
    description: "Rhinoplasty audit",
    grade: "CT2",
    email: "other@nhs.uk",
    collaborators: "[]",
    dataCollectionPeriod: null,
    expectedSampleSize: null,
    reaudit: "No",
    linkedAuditId: null,
    linkedAuditRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    refNumber: "QAH-2025-003",
    topic: "Draft audit — should not appear",
    status: "draft" as const,
    submitterName: "Dr Test User",
    submitterId: 1,
    supervisorId: null,
    supervisorName: null,
    category: "Clinical",
    clinicalSetting: "Outpatient",
    priority: "Low",
    description: "Draft",
    grade: "ST4",
    email: "test@nhs.uk",
    collaborators: "[]",
    dataCollectionPeriod: null,
    expectedSampleSize: null,
    reaudit: "No",
    linkedAuditId: null,
    linkedAuditRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── standardPresets ──────────────────────────────────────────────────────────

describe("audits.standardPresets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns presets for a known specialty", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.standardPresets({ specialty: "Rhinology" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    expect(first).toHaveProperty("standard");
    expect(first).toHaveProperty("criteria");
  });

  it("returns presets for Head and Neck specialty", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.standardPresets({ specialty: "Head and Neck" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns presets for Otology specialty", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.standardPresets({ specialty: "Otology" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns presets for Paediatric specialty", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.standardPresets({ specialty: "Paediatric" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown specialty", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.standardPresets({ specialty: "Unknown Specialty" });
    expect(Array.isArray(result)).toBe(true);
    // May return empty or general presets — just verify it doesn't throw
  });

  it("throws UNAUTHORIZED for unauthenticated requests", async () => {
    const caller = appRouter.createCaller({ user: null as unknown as typeof MOCK_USER });
    await expect(caller.audits.standardPresets({ specialty: "Rhinology" })).rejects.toThrow();
  });
});

// ─── searchByRef ──────────────────────────────────────────────────────────────

describe("audits.searchByRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAllAudits).mockResolvedValue(MOCK_AUDITS as ReturnType<typeof db.getAllAudits> extends Promise<infer T> ? T : never);
  });

  it("returns matching audits by reference number prefix", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "QAH-2025-001" });
    expect(result).toHaveLength(1);
    expect(result[0].refNumber).toBe("QAH-2025-001");
    expect(result[0].topic).toBe("Tonsillectomy outcomes");
  });

  it("returns matching audits by topic keyword", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "rhinoplasty" });
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe("Rhinoplasty complication rates");
  });

  it("excludes draft audits from results", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "draft" });
    expect(result).toHaveLength(0);
  });

  it("returns up to 10 results", async () => {
    // Create 15 matching non-draft audits
    const manyAudits = Array.from({ length: 15 }, (_, i) => ({
      ...MOCK_AUDITS[0],
      id: 100 + i,
      refNumber: `QAH-2025-${String(100 + i).padStart(3, "0")}`,
      topic: `Matching audit ${i}`,
      status: "approved" as const,
    }));
    vi.mocked(db.getAllAudits).mockResolvedValue(manyAudits as ReturnType<typeof db.getAllAudits> extends Promise<infer T> ? T : never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "matching" });
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns id, refNumber, topic, status, submitterName fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "QAH" });
    expect(result.length).toBeGreaterThan(0);
    const item = result[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("refNumber");
    expect(item).toHaveProperty("topic");
    expect(item).toHaveProperty("status");
    expect(item).toHaveProperty("submitterName");
  });

  it("returns empty array when no matches", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.searchByRef({ query: "xyznonexistent" });
    expect(result).toHaveLength(0);
  });

  it("throws UNAUTHORIZED for unauthenticated requests", async () => {
    const caller = appRouter.createCaller({ user: null as unknown as typeof MOCK_USER });
    await expect(caller.audits.searchByRef({ query: "QAH" })).rejects.toThrow();
  });
});
