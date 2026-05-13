/**
 * Tests for the profile settings procedures:
 *   - users.getProfile    — returns current user without passwordHash
 *   - users.updateProfile — updates personal details, enforces email uniqueness
 *   - users.changePassword — verifies current password, hashes and stores new one
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUserProfile: vi.fn(),
    updateUserPassword: vi.fn(),
  };
});

import {
  getUserById,
  getUserByEmail,
  updateUserProfile,
  updateUserPassword,
} from "./db";

// ─── Context factory ──────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1,
    openId: "local-clinician",
    email: "clinician@nhs.net",
    name: "Dr Clinician",
    loginMethod: "password",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Shared mock user ─────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 1,
  openId: "local-clinician",
  email: "clinician@porthosp.nhs.uk",
  name: "Dr Jane Smith",
  fullName: "Dr Jane Smith",
  title: "Dr",
  grade: "Registrar (SpR)",
  auditRole: "clinician" as const,
  role: "user" as const,
  loginMethod: "password" as const,
  // bcrypt of "OldPassword1!"
  passwordHash: "$2b$12$somehashedpassword",
  approved: true,
  roleApproved: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// ─── users.getProfile ─────────────────────────────────────────────────────────

describe("users.getProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user profile without passwordHash", async () => {
    vi.mocked(getUserById).mockResolvedValue(MOCK_USER);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.users.getProfile();

    expect(result).not.toHaveProperty("passwordHash");
    expect(result.fullName).toBe("Dr Jane Smith");
    expect(result.email).toBe("clinician@porthosp.nhs.uk");
  });

  it("throws NOT_FOUND when the user does not exist in the database", async () => {
    vi.mocked(getUserById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.users.getProfile()).rejects.toThrow();
  });
});

// ─── users.updateProfile ─────────────────────────────────────────────────────

describe("users.updateProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the user profile and returns the updated record without passwordHash", async () => {
    const updatedUser = { ...MOCK_USER, fullName: "Dr Jane Jones", email: "jane.jones@porthosp.nhs.uk" };
    // updateProfile calls getUserByEmail (uniqueness check), then updateUserProfile, then getUserById (to return updated)
    vi.mocked(getUserByEmail).mockResolvedValue(undefined); // no conflict
    vi.mocked(updateUserProfile).mockResolvedValue(undefined);
    vi.mocked(getUserById).mockResolvedValue(updatedUser); // called after update

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.users.updateProfile({
      fullName: "Dr Jane Jones",
      email: "jane.jones@porthosp.nhs.uk",
    });

    expect(updateUserProfile).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ fullName: "Dr Jane Jones", email: "jane.jones@porthosp.nhs.uk" })
    );
    expect(result.fullName).toBe("Dr Jane Jones");
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("throws CONFLICT when the new email is already used by another account", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({ ...MOCK_USER, id: 99 }); // different user owns that email

    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.users.updateProfile({ email: "taken@porthosp.nhs.uk" })
    ).rejects.toThrow(/already in use/i);

    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("allows updating email to the same address the user already has", async () => {
    // getUserByEmail returns the same user (id matches ctx.user.id)
    vi.mocked(getUserByEmail).mockResolvedValue(MOCK_USER);
    vi.mocked(getUserById)
      .mockResolvedValueOnce(MOCK_USER)
      .mockResolvedValueOnce(MOCK_USER);
    vi.mocked(updateUserProfile).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.users.updateProfile({ email: "clinician@porthosp.nhs.uk" })
    ).resolves.toBeDefined();
  });

  it("throws BAD_REQUEST when fullName is too short", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.users.updateProfile({ fullName: "X" })).rejects.toThrow();
  });
});

// ─── users.changePassword ─────────────────────────────────────────────────────

describe("users.changePassword", () => {
  // Use resetAllMocks to clear both call history AND mock implementations,
  // preventing stale mockResolvedValue from previous describe blocks leaking in.
  beforeEach(() => vi.resetAllMocks());

  it("changes the password when the current password is correct", async () => {
    // Generate a real bcrypt hash so bcrypt.compare works correctly in the procedure
    const bcryptjs = (await import("bcryptjs")).default;
    const realHash = await bcryptjs.hash("OldPassword1!", 10);
    // Verify the hash is valid before using it in the test
    const preCheck = await bcryptjs.compare("OldPassword1!", realHash);
    expect(preCheck).toBe(true); // sanity check

    // Use mockResolvedValue (not Once) so the mock persists through the procedure call
    vi.mocked(getUserById).mockResolvedValue({ ...MOCK_USER, passwordHash: realHash });
    vi.mocked(updateUserPassword).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.users.changePassword({
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword2@",
    });

    expect(result.success).toBe(true);
    expect(updateUserPassword).toHaveBeenCalledWith(1, expect.any(String));
    // Ensure the stored hash is not the plain text password
    const [, newHash] = vi.mocked(updateUserPassword).mock.calls[0]!;
    expect(newHash).not.toBe("NewPassword2@");
  });

  it("throws UNAUTHORIZED when the current password is incorrect", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("OldPassword1!", 10);
    vi.mocked(getUserById).mockResolvedValue({ ...MOCK_USER, passwordHash: hash });

    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.users.changePassword({ currentPassword: "WrongPassword!", newPassword: "NewPassword2@" })
    ).rejects.toThrow(/incorrect/i);

    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the account has no password (non-password login method)", async () => {
    vi.mocked(getUserById).mockResolvedValue({ ...MOCK_USER, passwordHash: null });

    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.users.changePassword({ currentPassword: "anything", newPassword: "NewPassword2@" })
    ).rejects.toThrow(/not available/i);
  });

  it("throws validation error when new password is shorter than 8 characters", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.users.changePassword({ currentPassword: "OldPassword1!", newPassword: "short" })
    ).rejects.toThrow();
  });
});
