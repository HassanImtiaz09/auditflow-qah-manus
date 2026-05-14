/**
 * Tests for auth.requestPasswordReset and auth.resetPassword procedures.
 *
 * Security requirements verified:
 *  1. requestPasswordReset NEVER returns a token in the response.
 *  2. Tokens are stored hashed (SHA-256); resetPassword hashes the raw token before lookup.
 *  3. Both email-exists and email-not-found branches return { success: true } only.
 */
import { createHash } from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock email helper so no real emails are sent ─────────────────────────────

vi.mock("./_core/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/email")>();
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
    sendVerificationEmail: vi.fn().mockResolvedValue(true),
    sendRegistrationConfirmationEmail: vi.fn().mockResolvedValue(true),
    sendAuditSubmissionEmails: vi.fn().mockResolvedValue(undefined),
    sendAuditStatusEmails: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Mock database helpers ────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getPasswordResetToken: vi.fn(),
    markPasswordResetTokenUsed: vi.fn(),
    updateUserPassword: vi.fn(),
  };
});

import {
  getUserByEmail,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

const MOCK_USER = {
  id: 42,
  openId: "local-abc",
  email: "doctor@nhs.net",
  name: "Dr Test",
  fullName: "Dr Test",
  title: "Dr",
  grade: "Consultant",
  auditRole: "consultant",
  passwordHash: "hashed",
  approved: true,
  roleApproved: true,
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  emailVerified: true,
  emailVerifyToken: null,
  linkedConsultantId: null,
};

// ─── requestPasswordReset ─────────────────────────────────────────────────────

describe("auth.requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { success: true } with NO token when the email exists", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(MOCK_USER);
    vi.mocked(createPasswordResetToken).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({ email: "doctor@nhs.net" });

    // Security requirement: token must NEVER appear in the response
    expect(result.success).toBe(true);
    expect((result as Record<string, unknown>).token).toBeUndefined();

    // DB helper must have been called with a HASHED token (64-char hex SHA-256)
    expect(createPasswordResetToken).toHaveBeenCalledWith(
      42,
      expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 hex = 64 chars
      expect.any(Date)
    );
  });

  it("returns { success: true } (no token) when the email does not exist — prevents enumeration", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({ email: "nobody@nhs.net" });

    expect(result.success).toBe(true);
    expect((result as Record<string, unknown>).token).toBeUndefined();
    expect(createPasswordResetToken).not.toHaveBeenCalled();
  });
});

// ─── resetPassword — hash round-trip ─────────────────────────────────────────

describe("auth.resetPassword", () => {
  // A raw token as it would appear in the URL
  const RAW_TOKEN = "a".repeat(64);
  // The SHA-256 hash of the raw token — this is what the DB stores
  const HASHED_TOKEN = createHash("sha256").update(RAW_TOKEN).digest("hex");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when the DB contains the hashed token and the caller supplies the raw token (hash round-trip)", async () => {
    // DB returns the HASHED token (as stored by requestPasswordReset)
    vi.mocked(getPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: HASHED_TOKEN,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: false,
      createdAt: new Date(),
    });
    vi.mocked(updateUserPassword).mockResolvedValue(undefined);
    vi.mocked(markPasswordResetTokenUsed).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // Caller supplies the RAW token (as it appears in the email link)
    const result = await caller.auth.resetPassword({
      token: RAW_TOKEN,
      newPassword: "NewSecure@123",
    });

    expect(result.success).toBe(true);
    // getPasswordResetToken must have been called with the HASHED token
    expect(getPasswordResetToken).toHaveBeenCalledWith(HASHED_TOKEN);
    expect(updateUserPassword).toHaveBeenCalledWith(42, expect.any(String));
    expect(markPasswordResetTokenUsed).toHaveBeenCalledWith(1);
  });

  it("throws BAD_REQUEST when the token does not exist", async () => {
    vi.mocked(getPasswordResetToken).mockResolvedValue(null);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({ token: "invalid", newPassword: "NewSecure@123" })
    ).rejects.toThrow("Invalid or expired reset link.");
  });

  it("throws BAD_REQUEST when the token has already been used", async () => {
    vi.mocked(getPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: HASHED_TOKEN,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: true,
      createdAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({ token: RAW_TOKEN, newPassword: "NewSecure@123" })
    ).rejects.toThrow("This reset link has already been used.");
  });

  it("throws BAD_REQUEST when the token has expired", async () => {
    vi.mocked(getPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: HASHED_TOKEN,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      used: false,
      createdAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({ token: RAW_TOKEN, newPassword: "NewSecure@123" })
    ).rejects.toThrow("This reset link has expired.");
  });
});
