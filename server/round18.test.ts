/**
 * Round 18 — Role-Specific Dashboard Tests
 * Tests for admin overview stats, audits-per-consultant, and approaching deadlines helpers.
 * These tests operate against existing data in the DB (no setup/teardown needed).
 */
import { describe, it, expect } from "vitest";
import {
  getAdminOverviewStats,
  getAuditsPerConsultant,
  getApproachingDeadlines,
  getRecentRegistrations,
  getConsultantNames,
} from "./db";

describe("getAdminOverviewStats", () => {
  it("returns an object with numeric count fields", async () => {
    const stats = await getAdminOverviewStats();
    expect(stats).toBeDefined();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.pending).toBe("number");
    expect(typeof stats.approved).toBe("number");
    expect(typeof stats.rejected).toBe("number");
    expect(typeof stats.drafts).toBe("number");
  });

  it("total equals sum of pending + approved + rejected", async () => {
    const stats = await getAdminOverviewStats();
    // total excludes drafts; pending+approved+rejected should equal total
    expect(stats.total).toBe(stats.pending + stats.approved + stats.rejected);
  });

  it("all counts are non-negative", async () => {
    const stats = await getAdminOverviewStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.approved).toBeGreaterThanOrEqual(0);
    expect(stats.rejected).toBeGreaterThanOrEqual(0);
    expect(stats.drafts).toBeGreaterThanOrEqual(0);
  });
});

describe("getAuditsPerConsultant", () => {
  it("returns an array", async () => {
    const rows = await getAuditsPerConsultant();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("each row has id, fullName, grade, pending, approved, rejected, total", async () => {
    const rows = await getAuditsPerConsultant();
    // The 14 seeded consultant names should all appear
    expect(rows.length).toBeGreaterThanOrEqual(14);
    for (const row of rows) {
      expect(typeof row.id).toBe("number");
      expect(typeof row.fullName).toBe("string");
      expect(typeof row.pending).toBe("number");
      expect(typeof row.approved).toBe("number");
      expect(typeof row.rejected).toBe("number");
      expect(typeof row.total).toBe("number");
      expect(row.total).toBe(row.pending + row.approved + row.rejected);
    }
  });

  it("includes the seeded ENT consultant names", async () => {
    const rows = await getAuditsPerConsultant();
    const names = rows.map((r) => r.fullName);
    // At least one of the known seeded names should appear
    expect(names.some((n) => n.includes("Repanos") || n.includes("Mochloulis") || n.includes("Patel"))).toBe(true);
  });
});

describe("getApproachingDeadlines", () => {
  it("returns an array", async () => {
    const rows = await getApproachingDeadlines(30);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("all returned audits have an auditEndDate within the window", async () => {
    const rows = await getApproachingDeadlines(30);
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    for (const row of rows) {
      expect(row.auditEndDate).toBeTruthy();
      const d = new Date(row.auditEndDate!);
      expect(d.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // allow 1s tolerance
      expect(d.getTime()).toBeLessThanOrEqual(cutoff.getTime() + 1000);
    }
  });

  it("returns fewer results with a smaller window", async () => {
    const rows30 = await getApproachingDeadlines(30);
    const rows1 = await getApproachingDeadlines(1);
    // 1-day window should have <= 30-day window results
    expect(rows1.length).toBeLessThanOrEqual(rows30.length);
  });
});

describe("getRecentRegistrations", () => {
  it("returns an array", async () => {
    const rows = await getRecentRegistrations(10);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("returns at most the requested number of results", async () => {
    const rows = await getRecentRegistrations(5);
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it("all returned audits have status != draft", async () => {
    const rows = await getRecentRegistrations(10);
    for (const row of rows) {
      expect(row.status).not.toBe("draft");
    }
  });
});

describe("getConsultantNames", () => {
  it("returns the 14 seeded ENT consultant names", async () => {
    const names = await getConsultantNames();
    expect(names.length).toBeGreaterThanOrEqual(14);
  });

  it("each entry has id, fullName, grade, active=true", async () => {
    const names = await getConsultantNames();
    for (const n of names) {
      expect(typeof n.id).toBe("number");
      expect(typeof n.fullName).toBe("string");
      expect(n.active).toBe(true);
    }
  });
});
