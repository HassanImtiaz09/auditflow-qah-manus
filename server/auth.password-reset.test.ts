/**
 * Tests for auth.requestPasswordReset and auth.resetPassword procedures.
 *
 * These tests mock the database helpers so no real DB connection is needed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

// ─── requestPasswordReset ─────────────────────────────────────────────────────

describe("auth.requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success:true with a token when the email exists", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
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
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    vi.mocked(createPasswordResetToken).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({ email: "doctor@nhs.net" });

    expect(result.success).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(result.token!.length).toBeGreaterThan(32);
    expect(createPasswordResetToken).toHaveBeenCalledWith(
      42,
      expect.any(String),
      expect.any(Date)
    );
  });

  it("returns success:true (no token) when the email does not exist — prevents enumeration", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({ email: "nobody@nhs.net" });

    expect(result.success).toBe(true);
    expect(result.token).toBeUndefined();
    expect(createPasswordResetToken).not.toHaveBeenCalled();
  });
});

// ─── resetPassword ────────────────────────────────────────────────────────────

describe("auth.resetPassword", () => {
  const VALID_TOKEN = "a".repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the password and marks the token used when the token is valid", async () => {
    vi.mocked(getPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
      used: false,
      createdAt: new Date(),
    });
    vi.mocked(updateUserPassword).mockResolvedValue(undefined);
    vi.mocked(markPasswordResetTokenUsed).mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resetPassword({
      token: VALID_TOKEN,
      newPassword: "NewSecure@123",
    });

    expect(result.success).toBe(true);
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
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: true,
      createdAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({ token: VALID_TOKEN, newPassword: "NewSecure@123" })
    ).rejects.toThrow("This reset link has already been used.");
  });

  it("throws BAD_REQUEST when the token has expired", async () => {
    vi.mocked(getPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: VALID_TOKEN,
      expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      used: false,
      createdAt: new Date(),
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({ token: VALID_TOKEN, newPassword: "NewSecure@123" })
    ).rejects.toThrow("This reset link has expired.");
  });
});
