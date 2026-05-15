/**
 * Tests for audits.publicStatus — the unauthenticated status lookup procedure.
 *
 * Verifies:
 * - Returns only the safe public fields (refNumber, status, decidedAt, category)
 * - Does NOT return sensitive fields (description, decisionNote, submittedById, etc.)
 * - Returns NOT_FOUND for unknown ref numbers
 * - Works without an authenticated session (publicProcedure)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock db module ────────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAuditPublicStatus: vi.fn(),
  };
});

import * as db from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Unauthenticated caller (no user in context) */
function makePublicCaller() {
  return appRouter.createCaller({
    user: null,
    req: {} as any,
    res: {} as any,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("audits.publicStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe public fields for a known ref number", async () => {
    const mockRow = {
      refNumber: "REF-20250515-0001",
      status: "approved" as const,
      decidedAt: new Date("2025-05-15T10:00:00Z"),
      category: "Rhinology",
    };
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(mockRow);

    const caller = makePublicCaller();
    const result = await caller.audits.publicStatus({ ref: "REF-20250515-0001" });

    expect(result).toEqual(mockRow);
    expect(db.getAuditPublicStatus).toHaveBeenCalledWith("REF-20250515-0001");
  });

  it("does not return sensitive fields", async () => {
    const mockRow = {
      refNumber: "REF-20250515-0001",
      status: "approved" as const,
      decidedAt: null,
      category: "Otology",
    };
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(mockRow);

    const caller = makePublicCaller();
    const result = await caller.audits.publicStatus({ ref: "REF-20250515-0001" });

    // Must not expose sensitive fields
    expect(result).not.toHaveProperty("description");
    expect(result).not.toHaveProperty("decisionNote");
    expect(result).not.toHaveProperty("submittedById");
    expect(result).not.toHaveProperty("supervisorId");
    expect(result).not.toHaveProperty("collaborators");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("objectives");
  });

  it("throws NOT_FOUND for an unknown ref number", async () => {
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(null);

    const caller = makePublicCaller();
    await expect(
      caller.audits.publicStatus({ ref: "REF-99999999-9999" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No audit found with that reference number.",
    });
  });

  it("is accessible without authentication (publicProcedure)", async () => {
    const mockRow = {
      refNumber: "REF-20250515-0002",
      status: "pending" as const,
      decidedAt: null,
      category: "Laryngology",
    };
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(mockRow);

    // No session cookie / user context
    const caller = makePublicCaller();
    await expect(
      caller.audits.publicStatus({ ref: "REF-20250515-0002" })
    ).resolves.not.toThrow();
  });

  it("normalises the ref input to uppercase before lookup", async () => {
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(null);

    const caller = makePublicCaller();
    await expect(
      caller.audits.publicStatus({ ref: "ref-20250515-0001" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // The DB helper should have been called with the uppercased ref
    expect(db.getAuditPublicStatus).toHaveBeenCalledWith("REF-20250515-0001");
  });

  it("returns null decidedAt for pending audits", async () => {
    const mockRow = {
      refNumber: "REF-20250515-0003",
      status: "pending" as const,
      decidedAt: null,
      category: "Paediatric ENT",
    };
    vi.mocked(db.getAuditPublicStatus).mockResolvedValue(mockRow);

    const caller = makePublicCaller();
    const result = await caller.audits.publicStatus({ ref: "REF-20250515-0003" });

    expect(result.decidedAt).toBeNull();
    expect(result.status).toBe("pending");
  });

  it("rejects empty ref string with a validation error", async () => {
    const caller = makePublicCaller();
    await expect(
      caller.audits.publicStatus({ ref: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
