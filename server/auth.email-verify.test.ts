/**
 * Tests for auth.verifyEmail and auth.resendVerification procedures.
 *
 * Security requirements verified:
 *  1. verifyEmail hashes the incoming raw token (SHA-256) before DB lookup.
 *  2. resendVerification stores the hashed token, sends the raw token in the email URL.
 *  3. Invalid / expired tokens are rejected with BAD_REQUEST.
 *  4. Already-verified accounts return success without error.
 */
import { createHash } from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock email helpers ────────────────────────────────────────────────────────

vi.mock("./_core/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/email")>();
  return {
    ...actual,
    sendVerificationEmail: vi.fn().mockResolvedValue(true),
    sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
    sendAuditSubmissionEmails: vi.fn().mockResolvedValue(undefined),
    sendAuditStatusEmails: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Mock database helpers ────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmailVerifyToken: vi.fn(),
    setEmailVerifyToken: vi.fn(),
    markEmailVerified: vi.fn(),
    getUserByEmail: vi.fn(),
  };
});

import {
  getUserByEmailVerifyToken,
  setEmailVerifyToken,
  markEmailVerified,
  getUserByEmail,
} from "./db";

import { sendVerificationEmail } from "./_core/email";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { origin: "https://auditqah-436kjx9h.manus.space" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const RAW_TOKEN = "b".repeat(64);
const HASHED_TOKEN = createHash("sha256").update(RAW_TOKEN).digest("hex");

const MOCK_UNVERIFIED_USER = {
  id: 7,
  openId: "local-xyz",
  email: "nurse@nhs.net",
  name: "Nurse Test",
  fullName: "Nurse Test",
  title: null,
  grade: "Nurse",
  auditRole: "clinician",
  passwordHash: "hashed",
  approved: true,
  roleApproved: true,
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  emailVerified: false,
  emailVerifyToken: HASHED_TOKEN,
  emailVerifyTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  linkedConsultantId: null,
};

// ─── auth.verifyEmail ─────────────────────────────────────────────────────────

describe("auth.verifyEmail — hashed token lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when caller supplies the raw token and DB stores the hashed token (hash round-trip)", async () => {
    // DB returns the user when queried with the HASHED token
    vi.mocked(getUserByEmailVerifyToken).mockResolvedValue(MOCK_UNVERIFIED_USER);
    vi.mocked(markEmailVerified).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.verifyEmail({ token: RAW_TOKEN });

    expect(result.success).toBe(true);
    // DB lookup must have been called with the HASHED token, not the raw one
    expect(getUserByEmailVerifyToken).toHaveBeenCalledWith(HASHED_TOKEN);
    expect(getUserByEmailVerifyToken).not.toHaveBeenCalledWith(RAW_TOKEN);
    expect(markEmailVerified).toHaveBeenCalledWith(7);
  });

  it("throws BAD_REQUEST when the token is not found in the DB", async () => {
    vi.mocked(getUserByEmailVerifyToken).mockResolvedValue(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.verifyEmail({ token: "invalid-raw-token" })
    ).rejects.toThrow("Invalid or expired verification link.");
  });

  it("returns success without calling markEmailVerified when already verified", async () => {
    vi.mocked(getUserByEmailVerifyToken).mockResolvedValue({
      ...MOCK_UNVERIFIED_USER,
      emailVerified: true,
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.verifyEmail({ token: RAW_TOKEN });

    expect(result.success).toBe(true);
    expect(markEmailVerified).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the token has expired", async () => {
    vi.mocked(getUserByEmailVerifyToken).mockResolvedValue({
      ...MOCK_UNVERIFIED_USER,
      emailVerifyTokenExpiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.verifyEmail({ token: RAW_TOKEN })
    ).rejects.toThrow("This verification link has expired.");
  });
});

// ─── auth.resendVerification ──────────────────────────────────────────────────

describe("auth.resendVerification — stores hashed token, sends raw token in email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a hashed token (64-char SHA-256 hex) and sends the raw token in the email", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(MOCK_UNVERIFIED_USER);
    vi.mocked(setEmailVerifyToken).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resendVerification({
      email: "nurse@nhs.net",
      origin: "https://auditqah-436kjx9h.manus.space",
    });

    expect(result.success).toBe(true);

    // setEmailVerifyToken must be called with a 64-char hex hash (SHA-256), not a raw token
    expect(setEmailVerifyToken).toHaveBeenCalledWith(
      7,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date)
    );

    // The raw token sent to sendVerificationEmail must NOT match the stored hash
    const storedHash = vi.mocked(setEmailVerifyToken).mock.calls[0][1] as string;
    const sentToken = (vi.mocked(sendVerificationEmail).mock.calls[0][0] as { token: string }).token;
    // The sent token is raw (64 hex chars from randomBytes) but different from the stored hash
    expect(sentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sentToken).not.toBe(storedHash);
    // Verify the relationship: sha256(sentToken) === storedHash
    const expectedHash = createHash("sha256").update(sentToken).digest("hex");
    expect(storedHash).toBe(expectedHash);
  });

  it("returns success silently when the user does not exist (prevents email enumeration)", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resendVerification({ email: "nobody@nhs.net" });

    expect(result.success).toBe(true);
    expect(setEmailVerifyToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns success silently when the user is already verified (prevents enumeration)", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      ...MOCK_UNVERIFIED_USER,
      emailVerified: true,
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resendVerification({ email: "nurse@nhs.net" });

    expect(result.success).toBe(true);
    expect(setEmailVerifyToken).not.toHaveBeenCalled();
  });
});
