/**
 * storage-proxy.test.ts
 *
 * Tests for the authenticated storage proxy.
 *
 * Strategy: spin up a minimal Express app with registerStorageProxy mounted,
 * mock the db helpers and the Forge fetch, then use supertest to drive HTTP
 * requests and assert the correct status codes.
 *
 * Four invariants under test:
 *  1. 401 when no cookie is present
 *  2. 401 when an invalid/tampered cookie is present
 *  3. 403 when a clinician tries to access another submitter's audit PDF
 *  4. 307 when the assigned consultant accesses their own audit PDF
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { SignJWT } from "jose";

// ─── Mock db module ────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(),
  getAuditById: vi.fn(),
}));

// ─── Mock global fetch (used by the Forge presign call) ───────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import after mocks ────────────────────────────────────────────────────────

import * as db from "./db";
import { registerStorageProxy } from "./_core/storageProxy";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COOKIE_SECRET = "test-secret-at-least-32-characters-long!!";

/** Override ENV.cookieSecret for tests */
vi.mock("./_core/env", () => ({
  ENV: {
    cookieSecret: "test-secret-at-least-32-characters-long!!",
    forgeApiUrl: "https://forge.example.com",
    forgeApiKey: "forge-test-key",
  },
}));

/** Sign a JWT with the test secret and return a cookie string */
async function makeSessionCookie(openId: string): Promise<string> {
  const secret = new TextEncoder().encode(COOKIE_SECRET);
  const token = await new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
  return `nhs_audit_session=${token}`;
}

/** Clinician who submitted audit 42 */
const SUBMITTER = {
  id: 10,
  openId: "clinician-submitter",
  name: "Dr. Smith",
  email: "smith@porthosp.nhs.uk",
  auditRole: "clinician" as const,
  role: "user" as const,
  linkedConsultantId: null,
  approved: true,
  roleApproved: true,
  emailVerified: true,
};

/** A different clinician — NOT the submitter */
const OTHER_CLINICIAN = {
  ...SUBMITTER,
  id: 20,
  openId: "clinician-other",
  name: "Dr. Jones",
  email: "jones@porthosp.nhs.uk",
};

/** Consultant assigned to audit 42 (linkedConsultantId=7 === audit.supervisorId=7) */
const ASSIGNED_CONSULTANT = {
  id: 42,
  openId: "consultant-assigned",
  name: "Mr. Costa Repanos",
  email: "c.repanos@porthosp.nhs.uk",
  auditRole: "consultant" as const,
  role: "user" as const,
  linkedConsultantId: 7,
  approved: true,
  roleApproved: true,
  emailVerified: true,
};

/** Audit 42 — submitted by SUBMITTER, assigned to consultantNames.id=7 */
const AUDIT_42 = {
  id: 42,
  refNumber: "REF-20260514-0042",
  topic: "ENT Audit",
  status: "pending" as const,
  supervisorId: 7,
  submittedById: SUBMITTER.id,
  archived: false,
};

// ─── Build test app ────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  registerStorageProxy(app);
  return app;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Storage proxy — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Forge presign returns a signed URL
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://s3.example.com/signed-url" }),
      text: async () => "",
    });
  });

  it("returns 401 when no cookie is sent", async () => {
    const app = buildApp();
    const res = await request(app).get("/manus-storage/audit-pdf/42/form.pdf");
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when an invalid/tampered cookie is sent", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/manus-storage/audit-pdf/42/form.pdf")
      .set("Cookie", "nhs_audit_session=this-is-not-a-valid-jwt");
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Storage proxy — authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://s3.example.com/signed-url" }),
      text: async () => "",
    });
    vi.mocked(db.getAuditById).mockResolvedValue(AUDIT_42 as never);
  });

  it("returns 403 when a clinician tries to access another submitter's audit PDF", async () => {
    // OTHER_CLINICIAN is authenticated but is NOT the submitter of audit 42
    vi.mocked(db.getUserByOpenId).mockResolvedValue(OTHER_CLINICIAN as never);
    const cookie = await makeSessionCookie(OTHER_CLINICIAN.openId);

    const app = buildApp();
    const res = await request(app)
      .get("/manus-storage/audit-pdf/42/form.pdf")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 307 when the assigned consultant accesses their audit PDF", async () => {
    // ASSIGNED_CONSULTANT has linkedConsultantId=7 which matches audit.supervisorId=7
    vi.mocked(db.getUserByOpenId).mockResolvedValue(ASSIGNED_CONSULTANT as never);
    const cookie = await makeSessionCookie(ASSIGNED_CONSULTANT.openId);

    const app = buildApp();
    const res = await request(app)
      .get("/manus-storage/audit-pdf/42/form.pdf")
      .set("Cookie", cookie)
      .redirects(0); // don't follow redirects — we want to assert 307

    expect(res.status).toBe(307);
    expect(res.headers.location).toBe("https://s3.example.com/signed-url");
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
