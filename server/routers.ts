import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";

const NHS_COOKIE = "nhs_audit_session";

async function signNhsToken(openId: string): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

async function verifyNhsToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.openId as string) ?? null;
  } catch {
    return null;
  }
}
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  approveUser,
  createAudit,
  createNotification,
  getAllAudits,
  getAllUsers,
  getAdminUsers,
  getApprovedConsultants,
  getAuditById,
  getAuditByRef,
  getAuditsForConsultant,
  getPendingUsers,
  getUnreadNotifications,
  getUserByEmail,
  getUserById,
  getUserByOpenId,
  markAllNotificationsRead,
  markNotificationRead,
  rejectUser,
  searchUsersByName,
  updateAudit,
  updateUserRole,
  upsertUser,
  countAudits,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
  createAuditEvent,
  getAuditEvents,
  createAuditComment,
  getAuditComments,
  updateUserProfile,
  getMyAudits,
  getMyDraftAudits,
  softDeleteAudit,
  restoreAudit,
  getAuditsForConsultantAll,
  getUserByLinkedConsultantId,
  updateLinkedConsultant,
  getConsultantNames,
  getAllConsultantNames,
  addConsultantName,
  updateConsultantName,
  deactivateConsultantName,
  reactivateConsultantName,
  getAdminOverviewStats,
  getAuditsPerConsultant,
  getApproachingDeadlines,
  getApproachingDeadlinesForConsultant,
  getApproachingDeadlinesForUser,
  getRecentRegistrations,
  getUserByEmailVerifyToken,
  setEmailVerifyToken,
  markEmailVerified,
  getConsultantNameById,
  getNextRefCounter,
  getAuditPublicStatus,
  computeEventHash,
  getAllAuditsIncludeDeleted,
  markReauditReminderSent,
  getAuditsForReauditReminder,
} from "./db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { getStandardPresets } from "../shared/auditStandards";
import { notifyOwner } from "./_core/notification";
import { sendAuditStatusEmails, sendVerificationEmail, sendRegistrationConfirmationEmail, sendAuditSubmissionEmails, sendPasswordResetEmail } from "./_core/email";

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(NHS_COOKIE, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  register: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(2),
        title: z.string().optional(),
        email: z.string().email(),
        grade: z.string().min(1),
        password: z.string().min(8),
        origin: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const isConsultant = input.grade === "Consultant" || input.grade === "Associate Specialist";
      const auditRole = isConsultant ? "consultant" : "clinician";
      const approved = !isConsultant;
      const roleApproved = !isConsultant;

      // Generate email verification token.
      // The raw token is sent in the URL; only the SHA-256 hash is stored at rest.
      const crypto = await import("crypto");
      const rawVerifyToken = crypto.randomBytes(32).toString("hex");
      const hashedVerifyToken = crypto.createHash("sha256").update(rawVerifyToken).digest("hex");
      const verifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const openId = `local-${nanoid()}`;
      await upsertUser({
        openId,
        email: input.email,
        fullName: input.fullName,
        name: input.fullName,
        title: input.title ?? null,
        grade: input.grade,
        passwordHash,
        auditRole,
        approved,
        roleApproved,
        loginMethod: "password",
        emailVerified: false,
      });

      const newUser = await getUserByEmail(input.email);
      if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed." });

      // Store the hashed token — never the raw token
      await setEmailVerifyToken(newUser.id, hashedVerifyToken, verifyTokenExpiresAt);

      // Send verification email (best-effort — non-fatal if provider not configured)
      const origin = input.origin ?? (ctx.req.headers.origin as string | undefined) ?? "https://auditqah-436kjx9h.manus.space";
      const emailSent = await sendVerificationEmail({
        to: input.email,
        recipientName: `${input.title ? input.title + " " : ""}${input.fullName}`,
        token: rawVerifyToken,
        origin,
      });

      if (isConsultant) {
        const adminUsers = await getAdminUsers();
        // In-app notification for every admin
        for (const admin of adminUsers) {
          await createNotification({
            recipientId: admin.id,
            userId: newUser.id,
            type: "consultant_registered",
            message: `${input.title ? input.title + " " : ""}${input.fullName} (${input.grade}) has registered and is requesting consultant access.`,
          });
        }
        // Push notification to the project owner (admin email via Manus notification service)
        try {
          await notifyOwner({
            title: "New Consultant Registration — Action Required",
            content: `${input.title ? input.title + " " : ""}${input.fullName} (${input.grade}, ${input.email}) has registered for a consultant account on AuditFlow ENT QAH and is awaiting your approval.\n\nPlease log in to the User Approvals page to review and approve or reject this request.`,
          });
        } catch {
          // Non-fatal: in-app notification already sent above
          logger.warn("[Register] Failed to send owner push notification for consultant registration");
        }
      }

      // Send registration confirmation email (separate from verification — gives user a record of their registration)
      await sendRegistrationConfirmationEmail({
        to: input.email,
        recipientName: `${input.title ? input.title + " " : ""}${input.fullName}`,
        grade: input.grade,
        isConsultant,
      });

      // If verification email could not be sent, return the verify URL so the frontend can show it
      const verifyUrl = emailSent ? null : `${origin}/verify-email?token=${rawVerifyToken}`;
      return { success: true, pending: isConsultant, pendingVerification: true, verifyUrl };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });

      // Block login for unverified email addresses (skip for admin accounts)
      // Use auditRole (canonical) — role is legacy/Manus-template
      if (!user.emailVerified && user.auditRole !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "EMAIL_NOT_VERIFIED",
        });
      }

      // Pending consultants are allowed to log in — they see a pending-approval
      // banner in the app until the admin approves their account.
      const token = await signNhsToken(user.openId);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(NHS_COOKIE, token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });

      return {
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          grade: user.grade,
          auditRole: user.auditRole,
          // role is legacy/Manus-template — included for client compatibility only; do not use for access decisions
          role: user.role,
        },
      };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // Always return { success: true } — never expose whether the email exists
      const user = await getUserByEmail(input.email);
      if (!user) return { success: true };

      // Generate a cryptographically secure random token (raw)
      const crypto = await import("crypto");
      const rawToken = crypto.randomBytes(32).toString("hex");
      // Hash the token before storing — the raw token is only ever in the URL
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await createPasswordResetToken(user.id, hashedToken, expiresAt);

      // Send the reset email with the raw token embedded in the link
      const origin =
        input.origin ||
        (ctx.req.headers["origin"] as string | undefined) ||
        "https://auditqah-436kjx9h.manus.space";
      await sendPasswordResetEmail({
        to: user.email!,
        recipientName: user.fullName ?? user.name ?? "User",
        token: rawToken,
        origin,
      });

      // Never return the token — response is always { success: true }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      // Hash the incoming raw token before lookup — tokens are stored hashed
      const crypto = await import("crypto");
      const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");
      const record = await getPasswordResetToken(hashedToken);
      if (!record) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link." });
      }
      if (record.used) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has already been used." });
      }
      if (new Date() > record.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(record.userId, passwordHash);
      await markPasswordResetTokenUsed(record.id);

      return { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Hash the incoming raw token before lookup — tokens are stored hashed at rest
      const crypto = await import("crypto");
      const hashedToken = crypto.createHash("sha256").update(input.token).digest("hex");
      const user = await getUserByEmailVerifyToken(hashedToken);
      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired verification link." });
      }
      if (user.emailVerified) {
        // Already verified — treat as success
        return { success: true };
      }
      if (user.emailVerifyTokenExpiresAt && new Date() > user.emailVerifyTokenExpiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link has expired. Please request a new one." });
      }
      await markEmailVerified(user.id);
      return { success: true };
    }),

  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // Always return success to prevent email enumeration
      const user = await getUserByEmail(input.email);
      if (!user || user.emailVerified) return { success: true };

      const crypto = await import("crypto");
      const rawVerifyToken = crypto.randomBytes(32).toString("hex");
      // Hash before storing — raw token is only ever in the email URL
      const hashedVerifyToken = crypto.createHash("sha256").update(rawVerifyToken).digest("hex");
      const verifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await setEmailVerifyToken(user.id, hashedVerifyToken, verifyTokenExpiresAt);

      const origin = input.origin ?? (ctx.req.headers.origin as string | undefined) ?? "https://auditqah-436kjx9h.manus.space";
      await sendVerificationEmail({
        to: user.email!,
        recipientName: user.fullName ?? user.name ?? "User",
        token: rawVerifyToken,
        origin,
      });

      return { success: true };
    }),

  currentUser: publicProcedure.query(async ({ ctx }) => {
    // Parse our custom NHS cookie from the raw Cookie header (independent from Manus OAuth)
    const rawCookies = ctx.req.headers.cookie ?? "";
    const match = rawCookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(NHS_COOKIE + "="));
    const token = match ? match.slice(NHS_COOKIE.length + 1) : undefined;
    if (!token) return null;
    const openId = await verifyNhsToken(token);
    if (!openId) return null;
    const user = await getUserByOpenId(openId);
    return user ?? null;
  }),
});

// ─── Audit Router ─────────────────────────────────────────────────────────────
//
// SUPERVISOR ID INVARIANTS — read before touching any supervisor-related code:
//
//  1. `audits.supervisorId`      always stores a `consultantNames.id` (the roster entry).
//  2. `users.linkedConsultantId` always stores a `consultantNames.id` for consultant accounts
//                                (null for clinicians and admins).
//  3. To check "is this user the assigned supervisor of this audit?":
//        audit.supervisorId === user.linkedConsultantId && user.linkedConsultantId !== null
//  4. To find the user account assigned to an audit:
//        getUserByLinkedConsultantId(audit.supervisorId)
//  5. To get the display name of an audit's supervisor:
//        getConsultantNameById(audit.supervisorId)  — NOT getUserById(audit.supervisorId)
//
// ─────────────────────────────────────────────────────────────────────────────

const auditRouter = router({
  // ADMIN-ONLY: full audit registry. Non-admins use audits.myAuditsRegistry.
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const all = await getAllAudits();
    return all.map((a) => ({
      ...a,
      collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
    }));
  }),

  myQueue: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) return [];
    if (user.auditRole === "admin") {
      const all = await getAllAudits();
      return all
        .filter((a) => a.status === "pending" && !a.archived)
        .map((a) => ({ ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] }));
    }
    if (user.auditRole === "consultant") {
      // supervisorId on audits refers to the seeded consultantNames record id (linkedConsultantId),
      // NOT the user account id — use linkedConsultantId for the lookup.
      const lookupId = user.linkedConsultantId ?? -1;
      const mine = await getAuditsForConsultant(lookupId);
      return mine.map((a) => ({ ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] }));
    }
    return [];
  }),

  byRef: protectedProcedure
    .input(z.object({ ref: z.string() }))
    .query(async ({ input }) => {
      const a = await getAuditByRef(input.ref);
      if (!a) return null;
      return { ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] };
    }),

  /** Returns a single draft audit by ID (owner only) */
  getDraft: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ input, ctx }) => {
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Not a draft." });
      return {
        ...audit,
        collaborators: audit.collaborators ? JSON.parse(audit.collaborators) : [],
        reasonForAudit: audit.reasonForAudit ? JSON.parse(audit.reasonForAudit) : [],
        supportRequired: audit.supportRequired ? JSON.parse(audit.supportRequired) : [],
        dataSource: audit.dataSource ? JSON.parse(audit.dataSource) : [],
        resultsPresentation: audit.resultsPresentation ? JSON.parse(audit.resultsPresentation) : [],
        auditStandards: audit.auditStandards ? JSON.parse(audit.auditStandards) : [],
      };
    }),

  /** Returns the current user's own draft audits */
  myDrafts: protectedProcedure.query(async ({ ctx }) => {
    const drafts = await getMyDraftAudits(ctx.user.id);
    return drafts.map((a) => ({
      ...a,
      collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
      reasonForAudit: a.reasonForAudit ? JSON.parse(a.reasonForAudit) : [],
      supportRequired: a.supportRequired ? JSON.parse(a.supportRequired) : [],
      dataSource: a.dataSource ? JSON.parse(a.dataSource) : [],
      resultsPresentation: a.resultsPresentation ? JSON.parse(a.resultsPresentation) : [],
      auditStandards: a.auditStandards ? JSON.parse(a.auditStandards) : [],
    }));
  }),

  /** Returns the current user's own submitted/approved/rejected audits (non-draft) */
  mySubmissions: protectedProcedure.query(async ({ ctx }) => {
    const all = await getMyAudits(ctx.user.id);
    return all
      .filter((a) => a.status !== "draft")
      .map((a) => ({
        ...a,
        collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
      }));
  }),

  /**
   * Returns audits the current user is involved in:
   *   - submitter (submittedById === user.id)
   *   - collaborator (listed in the JSON collaborators array by email)
   *   - assigned supervisor (user.linkedConsultantId === audit.supervisorId)
   * Admins receive all audits (same as audits.list).
   * Used by the Audit Registry page for non-admin users.
   */
  myAuditsRegistry: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const all = await getAllAudits();
    const parsed = all.map((a) => ({
      ...a,
      collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
    }));

    // Admins see everything
    if (user.auditRole === "admin") return parsed;

    return parsed.filter((a) => {
      // Submitter
      if (a.submittedById === user.id) return true;
      // Assigned supervisor
      if (
        user.linkedConsultantId !== null &&
        user.linkedConsultantId !== undefined &&
        a.supervisorId !== null &&
        user.linkedConsultantId === a.supervisorId
      ) return true;
      // Collaborator — collaborators is an array of {name, email} or legacy strings
      const collabs: Array<{ name?: string; email?: string } | string> = a.collaborators;
      if (collabs.some((c) =>
        typeof c === "string"
          ? c === user.email
          : c.email === user.email
      )) return true;
      return false;
    });
  }),

  /** Delete a draft audit (owner only) */
  deleteDraft: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft audits can be deleted." });
      await softDeleteAudit(input.auditId);
      await createAuditEvent({
        auditId: input.auditId,
        actorId: ctx.user.id,
        actorName: ctx.user.fullName ?? ctx.user.name ?? "Unknown",
        eventType: "deleted",
        detail: "Draft deleted by submitter",
      });
      return { success: true };
    }),

  /** Update a draft audit with new field values (owner only, draft status only) */
  updateDraft: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        // Step 1 fields
        category: z.string().optional(),
        clinicalSetting: z.string().optional(),
        priority: z.enum(["Routine", "Standard", "High", "Urgent"]).optional(),
        reaudit: z.string().optional(),
        topic: z.string().optional(),
        dataCollectionPeriod: z.string().optional(),
        expectedSampleSize: z.string().optional(),
        collaborators: z.array(z.object({ name: z.string(), email: z.string() })).optional(),
        description: z.string().optional(),
        supervisorId: z.number().nullable().optional(),
        // Step 2 fields
        reasonForAudit: z.array(z.string()).optional(),
        reasonForAuditOther: z.string().optional(),
        cqcRegulation: z.string().optional(),
        priorityType: z.enum(["national", "regional", "local"]).nullable().optional(),
        priorityTypeOther: z.string().optional(),
        supportRequired: z.array(z.string()).optional(),
        supportRequiredOther: z.string().optional(),
        auditStartDate: z.date().nullable().optional(),
        auditEndDate: z.date().nullable().optional(),
        auditObjectives: z.string().optional(),
        whoInvolved: z.string().optional(),
        auditStandards: z.array(z.object({
          standard: z.string(),
          criteria: z.string(),
          compliance: z.string(),
          exceptions: z.string(),
        })).optional(),
        evidenceBase: z.string().optional(),
        stakeholders: z.string().optional(),
        stakeholdersInformed: z.boolean().optional(),
        dataSource: z.array(z.string()).optional(),
        dataSourceOther: z.string().optional(),
        dataCollectionMethodDetail: z.string().optional(),
        dataCollectionTiming: z.enum(["retrospective", "prospective"]).nullable().optional(),
        dataCollectedBy: z.string().optional(),
        samplingMethodDetail: z.string().optional(),
        dataAnalysisDetail: z.string().optional(),
        dataAnalysedBy: z.string().optional(),
        resultsPresentation: z.array(z.string()).optional(),
        resultsPresentationOther: z.string().optional(),
        actionPlanOwner: z.string().optional(),
        barriersToChange: z.string().optional(),
        reAuditTimeline: z.enum(["na", "6months", "12months", "other"]).nullable().optional(),
        reAuditTimelineOther: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft audits can be updated this way." });

      const { auditId, collaborators, reasonForAudit, supportRequired, dataSource, resultsPresentation, auditStandards, supervisorId, ...rest } = input;

      // Resolve supervisor name if supervisorId changed
      let supervisorName: string | null | undefined = undefined;
      if (supervisorId !== undefined) {
        if (supervisorId === null) {
          supervisorName = null;
        } else {
          // supervisorId is a consultantNames.id — look up the roster entry, not a user account
          const sup = await getConsultantNameById(supervisorId);
          supervisorName = sup ? `${sup.title ? sup.title + " " : ""}${sup.fullName}`.trim() : null;
        }
      }

      const updateData: Record<string, unknown> = { ...rest };
      if (collaborators !== undefined) updateData.collaborators = JSON.stringify(collaborators);
      if (reasonForAudit !== undefined) updateData.reasonForAudit = JSON.stringify(reasonForAudit);
      if (supportRequired !== undefined) updateData.supportRequired = JSON.stringify(supportRequired);
      if (dataSource !== undefined) updateData.dataSource = JSON.stringify(dataSource);
      if (resultsPresentation !== undefined) updateData.resultsPresentation = JSON.stringify(resultsPresentation);
      if (auditStandards !== undefined) updateData.auditStandards = JSON.stringify(auditStandards);
      if (supervisorId !== undefined) { updateData.supervisorId = supervisorId; updateData.supervisorName = supervisorName; }

      await updateAudit(input.auditId, updateData as Parameters<typeof updateAudit>[1]);

      // Record draft_saved event
      const actor = await getUserById(ctx.user.id);
      await createAuditEvent({
        auditId: input.auditId,
        actorId: ctx.user.id,
        actorName: actor?.fullName ?? actor?.name ?? "Unknown",
        eventType: "draft_saved",
        detail: null,
      });

      return { success: true };
    }),

  /** Promote a draft to submitted (triggers audit trail event) */
  submitDraft: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Audit is not a draft." });
      if (!audit.topic || audit.topic.length < 3) throw new TRPCError({ code: "BAD_REQUEST", message: "Audit title is required before submitting." });

      // ── Step 2 validation (only on final submit, not draft saves) ──
      const validationErrors: string[] = [];

      if (!audit.auditObjectives || audit.auditObjectives.trim().length === 0) {
        validationErrors.push("Audit Objectives");
      }

      const parsedStandards = (() => {
        try { return audit.auditStandards ? JSON.parse(audit.auditStandards) : []; }
        catch { return []; }
      })();
      if (!Array.isArray(parsedStandards) || parsedStandards.length === 0) {
        validationErrors.push("Audit Standards (at least one row required)");
      }

      if (!audit.dataCollectionMethodDetail || audit.dataCollectionMethodDetail.trim().length === 0) {
        validationErrors.push("Data Collection Method");
      }

      if (validationErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Please complete the following required fields before submitting: ${validationErrors.join(", ")}.`,
          cause: { fields: validationErrors },
        });
      }

      await updateAudit(input.auditId, { status: "pending", submittedAt: new Date() });

      const actor = await getUserById(ctx.user.id);
      await createAuditEvent({
        auditId: input.auditId,
        actorId: ctx.user.id,
        actorName: actor?.fullName ?? actor?.name ?? "Unknown",
        eventType: "submitted",
        detail: audit.supervisorName ? `Assigned to ${audit.supervisorName}` : null,
      });

      // Notify all admins
      const adminUsers = await getAdminUsers();
      for (const admin of adminUsers) {
        await createNotification({
          recipientId: admin.id,
          userId: ctx.user.id,
          type: "audit_submitted",
          message: `${actor?.fullName ?? "A user"} submitted audit: ${audit.topic ?? audit.refNumber}`,
        });
      }

      // Notify the assigned consultant (if any) — find the user account linked to this consultant
      if (audit.supervisorId) {
        const consultantUser = await getUserByLinkedConsultantId(audit.supervisorId);
        if (consultantUser) {
          const submitterName = actor?.fullName ?? actor?.name ?? "A colleague";
          await createNotification({
            recipientId: consultantUser.id,
            userId: ctx.user.id,
            type: "audit_assigned",
            message: `${submitterName} has registered audit "${audit.topic ?? audit.refNumber}" (${audit.refNumber}) and selected you as the supervising consultant. Please review it in your Approval Queue.`,
          });
        }
      }

      return { success: true, refNumber: audit.refNumber };
    }),

  submit: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        clinicalSetting: z.string(),
        priority: z.enum(["Routine", "Standard", "High", "Urgent"]),
        reaudit: z.string().optional(),
        topic: z.string().min(3),
        dataCollectionPeriod: z.string().optional(),
        expectedSampleSize: z.string().optional(),
        collaborators: z.array(z.object({ name: z.string(), email: z.string() })).optional(),
        description: z.string().min(10),
        supervisorId: z.number().optional(),
        isDraft: z.boolean().optional(),
        // Step 2 fields (optional — validated on final submit)
        auditObjectives: z.string().optional(),
        auditStandards: z.string().optional(),
        dataCollectionMethodDetail: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Step 2 validation — only enforced on final submission (not draft saves)
      if (!input.isDraft) {
        const missing: string[] = [];
        if (!input.auditObjectives?.trim()) missing.push("Audit Objectives");
        const standards = input.auditStandards ? JSON.parse(input.auditStandards) : [];
        if (!Array.isArray(standards) || !standards.some((s: { standard?: string }) => s.standard?.trim())) {
          missing.push("Audit Standards (at least one row required)");
        }
        if (!input.dataCollectionMethodDetail?.trim()) missing.push("Data Collection Method");
        if (missing.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Please complete the following before submitting: ${missing.join(", ")}`,
            cause: { fields: missing },
          });
        }
      }

      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const dy = String(now.getDate()).padStart(2, "0");
      const dateKey = `${y}${mo}${dy}`;
      // Atomically increment the per-date counter so concurrent submissions
      // always receive a unique sequence number (no race condition).
      const seq = String(await getNextRefCounter(dateKey)).padStart(4, "0");
      const refNumber = `REF-${y}${mo}${dy}-${seq}`;

       let supervisorName: string | null = null;
      if (input.supervisorId) {
        // supervisorId is a consultantNames.id — look up the roster entry, not a user account
        const sup = await getConsultantNameById(input.supervisorId);
        supervisorName = sup ? `${sup.title ? sup.title + " " : ""}${sup.fullName}`.trim() : null;
      }
      const audit = await createAudit({
        refNumber,
        submittedById: user.id,
        submitterName: user.fullName ?? user.name ?? null,
        submitterEmail: user.email ?? null,
        submitterGrade: user.grade ?? null,
        supervisorId: input.supervisorId ?? null,
        supervisorName,
        category: input.category,
        clinicalSetting: input.clinicalSetting,
        priority: input.priority,
        reaudit: input.reaudit ?? null,
        topic: input.topic,
        dataCollectionPeriod: input.dataCollectionPeriod ?? null,
        expectedSampleSize: input.expectedSampleSize ?? null,
        collaborators: input.collaborators ? JSON.stringify(input.collaborators) : null,
        description: input.description,
        status: input.isDraft ? "draft" : "pending",
        submittedAt: input.isDraft ? null : now,
      });

      // Record audit trail event and send notifications on final submission
      if (!input.isDraft) {
        await createAuditEvent({
          auditId: (audit as { id: number }).id,
          actorId: user.id,
          actorName: user.fullName ?? user.name ?? "Unknown",
          eventType: "submitted",
          detail: supervisorName ? `Assigned to ${supervisorName}` : null,
        });
        // Notify all admins
        const adminUsers = await getAdminUsers();
        for (const adminUser of adminUsers) {
          await createNotification({
            recipientId: adminUser.id,
            userId: user.id,
            type: "audit_submitted",
            message: `${user.fullName ?? "A user"} submitted audit: ${input.topic}`,
          });
        }
        // Notify the assigned consultant (if any)
        if (input.supervisorId) {
          const consultantUser = await getUserByLinkedConsultantId(input.supervisorId);
          if (consultantUser) {
            const submitterName = user.fullName ?? user.name ?? "A colleague";
            await createNotification({
              recipientId: consultantUser.id,
              userId: user.id,
              type: "audit_assigned",
              message: `${submitterName} has registered audit "${input.topic}" (${refNumber}) and selected you as the supervising consultant. Please review it in your Approval Queue.`,
            });
          }
        }
        // Send submission confirmation emails to submitter and collaborators
        const supervisorUser = input.supervisorId ? await getUserByLinkedConsultantId(input.supervisorId) : null;
        await sendAuditSubmissionEmails({
          refNumber,
          topic: input.topic,
          submitterName: user.fullName ?? user.name ?? "Auditor",
          submitterEmail: user.email ?? null,
          supervisorName,
          collaborators: input.collaborators ? JSON.stringify(input.collaborators) : null,
          supervisorEmail: supervisorUser?.email ?? null,
        });
      }

      return { success: true, refNumber, audit };
    }),

  decide: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        // Consultants use "approved" / "rejected".
        // Admins must use the "admin_override_*" variants to explicitly signal an override.
        // This prevents accidental admin decisions on audits not assigned to them.
        decision: z.enum(["approved", "rejected", "changes_requested", "admin_override_approved", "admin_override_rejected", "admin_override_changes_requested"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || (user.auditRole !== "consultant" && user.auditRole !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Role / decision-variant consistency check:
      // - Consultants may only use the regular variants (approved, rejected, changes_requested).
      // - Admins may only use the admin_override variants.
      const isOverride = input.decision.startsWith("admin_override_");
      if (user.auditRole === "consultant" && isOverride) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Consultants cannot use admin override decisions." });
      }
      if (user.auditRole === "admin" && !isOverride) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admins must use admin_override_approved, admin_override_rejected, or admin_override_changes_requested." });
      }

      // Fetch the audit — needed for the status guard and subsequent notifications.
      const auditForDecide = await getAuditById(input.auditId);
      if (!auditForDecide) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Audit not found." });
      }

      // Status guard: only pending audits can be decided.
      if (auditForDecide.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Audit is not pending — decision cannot be applied.",
        });
      }

      // Consultants may only decide on audits explicitly assigned to them as supervisor.
      if (user.auditRole === "consultant") {
        const assignedId = user.linkedConsultantId ?? -1;
        if (auditForDecide.supervisorId !== assignedId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not the assigned supervisor for this audit." });
        }
      }

      // Resolve the canonical status and trail event type from the decision variant.
      type CanonicalDecision = "approved" | "rejected" | "changes_requested";
      const canonicalStatus: CanonicalDecision = isOverride
        ? (input.decision === "admin_override_approved" ? "approved"
          : input.decision === "admin_override_rejected" ? "rejected"
          : "changes_requested")
        : (input.decision as CanonicalDecision);
      const trailEventType: "approved" | "rejected" | "changes_requested" = canonicalStatus;
      const trailDetail = isOverride
        ? `Admin override — ${input.note ?? ""}`
        : (input.note ?? null);

      await updateAudit(input.auditId, {
        status: canonicalStatus,
        decisionNote: input.note ?? null,
        decidedById: user.id,
        decidedAt: new Date(),
      });
      // Record audit trail event
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: trailEventType,
        detail: trailDetail,
      });
      // Notify the submitter of the decision (in-app)
      if (auditForDecide.submittedById) {
        const deciderName = user.fullName ?? user.name ?? "Your supervisor";
        const refNum = auditForDecide.refNumber;
        const noteText = input.note ? ` Note: "${input.note}"` : "";
        const notifType =
          canonicalStatus === "approved" ? "audit_approved" as const
          : canonicalStatus === "rejected" ? "audit_rejected" as const
          : "audit_changes_requested" as const;
        const msgVerb =
          canonicalStatus === "approved" ? "approved"
          : canonicalStatus === "rejected" ? "rejected"
          : "returned with changes requested";
        await createNotification({
          recipientId: auditForDecide.submittedById,
          userId: user.id,
          type: notifType,
          message: `Your audit ${refNum} has been ${msgVerb} by ${deciderName}.${noteText}`,
        });
      }
      // Send email notifications to submitter, collaborators, and acting consultant
      const actorName = user.fullName ?? user.name ?? "Your supervisor";
      await sendAuditStatusEmails({
        audit: auditForDecide,
        decision: canonicalStatus,
        actorName,
        actorEmail: user.email ?? null,
        note: input.note ?? null,
      });
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ auditId: z.number(), archived: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const auditForArchive = await getAuditById(input.auditId);
      await updateAudit(input.auditId, { archived: input.archived });
      // Record audit trail event
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: input.archived ? "archived" : "unarchived",
        detail: null,
      });
      // Send email notifications to submitter and collaborators
      if (auditForArchive) {
        const actorName = user.fullName ?? user.name ?? "An administrator";
        await sendAuditStatusEmails({
          audit: auditForArchive,
          decision: input.archived ? "archived" : "unarchived",
          actorName,
          actorEmail: user.email ?? null,
        });
      }
      return { success: true };
    }),

  // Admin-only: reassign the supervising consultant on a pending audit
  reassign: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        /** Pass null to remove the supervisor assignment */
        supervisorId: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      let supervisorName: string | null = null;
      if (input.supervisorId !== null) {
        // supervisorId is a consultantNames.id — validate against the roster, not user accounts
        const sup = await getConsultantNameById(input.supervisorId);
        if (!sup || !sup.active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid consultant selected." });
        }
        supervisorName = `${sup.title ? sup.title + " " : ""}${sup.fullName}`.trim();
      }
      const auditForReassign = await getAuditById(input.auditId);
      if (!auditForReassign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Audit not found." });
      }
      // Status guard: only pending audits can be reassigned.
      if (auditForReassign.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Audit is not pending — reassignment cannot be applied.",
        });
      }
      await updateAudit(input.auditId, {
        supervisorId: input.supervisorId,
        supervisorName,
      });
      // Record audit trail event
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: "reassigned",
        detail: supervisorName ? `Reassigned to ${supervisorName}` : "Supervisor removed",
      });
      // Notify the newly assigned consultant (if any) — in-app
      // Look up the user account linked to this consultantNames row (may be null if not yet registered)
      if (input.supervisorId !== null && auditForReassign) {
        const consultantUser = await getUserByLinkedConsultantId(input.supervisorId);
        if (consultantUser) {
          const adminName = user.fullName ?? user.name ?? "An administrator";
          const refNum = auditForReassign.refNumber;
          await createNotification({
            recipientId: consultantUser.id,
            userId: user.id,
            type: "audit_reassigned",
            message: `${adminName} has assigned audit ${refNum} to you for review.`,
          });
        }
      }
      // Send email notifications to submitter, collaborators, admin, and the newly assigned supervisor
      if (auditForReassign) {
        const actorName = user.fullName ?? user.name ?? "An administrator";
        // Look up the linked user account for the new supervisor to get their email
        let newSupervisorEmail: string | null = null;
        let newSupervisorRecipientName: string | null = null;
        if (input.supervisorId !== null) {
          const supUser = await getUserByLinkedConsultantId(input.supervisorId);
          if (supUser?.email) {
            newSupervisorEmail = supUser.email;
            newSupervisorRecipientName = supUser.fullName ?? supUser.name ?? supervisorName;
          }
        }
        await sendAuditStatusEmails({
          audit: auditForReassign,
          decision: "reassigned",
          actorName,
          actorEmail: user.email ?? null,
          newSupervisorName: supervisorName,
          newSupervisorEmail,
          newSupervisorRecipientName,
        });
      }
      return { success: true };
    }),

  // ACL: admin, submitter, or assigned supervisor (linkedConsultantId === audit.supervisorId)
  history: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ input, ctx }) => {
      const actor = await getUserById(ctx.user.id);
      if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (actor.auditRole !== "admin") {
        const audit = await getAuditById(input.auditId);
        if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
        const isSubmitter = audit.submittedById === actor.id;
        const isSupervisor =
          actor.linkedConsultantId !== null &&
          actor.linkedConsultantId !== undefined &&
          audit.supervisorId !== null &&
          actor.linkedConsultantId === audit.supervisorId;
        if (!isSubmitter && !isSupervisor) throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getAuditEvents(input.auditId);
    }),

  /**
   * Verify the tamper-evident hash chain for an audit's trail.
   *
   * Fetches all events for the given audit in chronological order, recomputes
   * each SHA-256 link, and returns whether the chain is intact.
   *
   * Access: same as audits.history — admin always, submitter or supervisor otherwise.
   */
  verifyTrail: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ input, ctx }) => {
      const actor = await getUserById(ctx.user.id);
      if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (actor.auditRole !== "admin") {
        const audit = await getAuditById(input.auditId);
        if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
        const isSubmitter = audit.submittedById === actor.id;
        const isSupervisor =
          actor.linkedConsultantId !== null &&
          actor.linkedConsultantId !== undefined &&
          audit.supervisorId !== null &&
          actor.linkedConsultantId === audit.supervisorId;
        if (!isSubmitter && !isSupervisor) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const events = await getAuditEvents(input.auditId);

      // Events with no hash (legacy rows inserted before this feature) are
      // treated as valid — we only verify the chain from the first hashed event.
      const hashedEvents = events.filter((e) => e.hash !== null && e.hash !== undefined);

      if (hashedEvents.length === 0) {
        return { valid: true, brokenAt: null, eventCount: events.length, hashedCount: 0 };
      }

      let expectedPrevHash = "0";
      let brokenAt: number | null = null;

      for (const event of hashedEvents) {
        if (event.prevHash !== expectedPrevHash) {
          brokenAt = event.id;
          break;
        }
        const recomputed = computeEventHash(event.prevHash!, {
          auditId: event.auditId,
          actorId: event.actorId,
          actorName: event.actorName,
          eventType: event.eventType,
          detail: event.detail,
          createdAt: event.createdAt,
        });
        if (recomputed !== event.hash) {
          brokenAt = event.id;
          break;
        }
        expectedPrevHash = event.hash!;
      }

      return { valid: brokenAt === null, brokenAt, eventCount: events.length, hashedCount: hashedEvents.length };
    }),

  /** Returns the canonical ENT consultant roster from the consultantNames table */
  consultants: protectedProcedure.query(async () => {
    const names = await getConsultantNames();
    return names.map((c) => ({
      id: c.id,
      fullName: `${c.title ? c.title + " " : ""}${c.fullName}`,
      displayName: c.fullName,
      grade: c.grade ?? "",
    }));
  }),

  /** Admin: add a new name to the consultant roster */
  addConsultantName: protectedProcedure
    .input(z.object({
      title: z.string().optional(),
      fullName: z.string().min(2),
      grade: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const admin = await getUserById(ctx.user.id);
      if (!admin || admin.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await addConsultantName({ fullName: input.fullName, title: input.title, grade: input.grade });
      return { success: true };
    }),

  /**
   * Returns all non-draft audits assigned to the logged-in consultant (pending + approved + rejected),
   * grouped by status. Used for the consultant dashboard.
   */
  myConsultantQueue: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || (user.auditRole !== "consultant" && user.auditRole !== "admin")) {
      return { pending: [], approved: [], rejected: [] };
    }
    // supervisorId on audits is a consultantNames.id.
    // Consultants look up their assigned audits via linkedConsultantId.
    // Admins are NOT supervisors — return all non-draft audits for admin overview.
    let mapped: ReturnType<typeof Object.assign>[];
    if (user.auditRole === "admin") {
      const all = await getAllAudits();
      mapped = all
        .filter((a) => a.status !== "draft")
        .map((a) => ({ ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] }));
    } else {
      // Consultant: must have linkedConsultantId set to see any audits
      const lookupId = user.linkedConsultantId ?? -1;
      const all = await getAuditsForConsultantAll(lookupId);
      mapped = all.map((a) => ({ ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] }));
    }
    return {
      pending: mapped.filter((a) => a.status === "pending"),
      approved: mapped.filter((a) => a.status === "approved"),
      rejected: mapped.filter((a) => a.status === "rejected"),
      changes_requested: mapped.filter((a) => a.status === "changes_requested"),
    };
  }),

  /**
   * Clinician: audits with auditEndDate within the next 30 days (own submissions only).
   * Used by ClinicianDashboard P23.
   */
  myDeadlines: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const raw = await getApproachingDeadlinesForUser(ctx.user.id, 30);
    return raw.map(a => ({
      id: a.id,
      refNumber: a.refNumber,
      topic: a.topic,
      category: a.category,
      status: a.status,
      auditEndDate: a.auditEndDate,
      daysRemaining: a.auditEndDate
        ? Math.ceil((new Date(a.auditEndDate).getTime() - Date.now()) / 86400000)
        : null,
    }));
  }),

  /**
   * Consultant: audits with auditEndDate within the next 30 days (assigned audits only).
   * Used by ConsultantDashboard P23.
   */
  consultantDeadlines: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || (user.auditRole !== "consultant" && user.auditRole !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const lookupId = user.linkedConsultantId ?? -1;
    const raw = user.auditRole === "admin"
      ? await getApproachingDeadlines(30)
      : await getApproachingDeadlinesForConsultant(lookupId, 30);
    return raw.map(a => ({
      id: a.id,
      refNumber: a.refNumber,
      topic: a.topic,
      category: a.category,
      status: a.status,
      submitterName: a.submitterName,
      auditEndDate: a.auditEndDate,
      daysRemaining: a.auditEndDate
        ? Math.ceil((new Date(a.auditEndDate).getTime() - Date.now()) / 86400000)
        : null,
    }));
  }),

  /**
   * Clinician: resubmit an audit that has been returned with changes_requested.
   * Resets status to 'pending' and records a 'resubmitted' trail event.
   */
  resubmit: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "changes_requested") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only audits with status 'changes_requested' can be resubmitted." });
      }
      await updateAudit(input.auditId, { status: "pending", decidedAt: null, decisionNote: null });
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: "resubmitted",
        detail: "Resubmitted after changes requested",
      });
      // Notify the assigned supervisor (if any)
      if (audit.supervisorId) {
        const supervisorUser = await getUserByLinkedConsultantId(audit.supervisorId);
        if (supervisorUser) {
          await createNotification({
            recipientId: supervisorUser.id,
            userId: user.id,
            type: "audit_resubmitted",
            message: `Audit ${audit.refNumber} has been resubmitted by ${user.fullName ?? user.name ?? "the clinician"} after changes.`,
          });
        }
      }
      return { success: true };
    }),

  /**
   * Admin: soft-delete an audit (sets deletedAt, hides from all list queries).
   * The audit can be restored via audits.restore.
   */
  softDelete: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Audit is already deleted." });
      await softDeleteAudit(input.auditId);
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: "deleted",
        detail: "Soft-deleted by admin",
      });
      return { success: true };
    }),

  /**
   * Admin: restore a soft-deleted audit (clears deletedAt).
   */
  restore: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (!audit.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Audit is not deleted." });
      await restoreAudit(input.auditId);
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: "restored",
        detail: "Restored by admin",
      });
      return { success: true };
    }),

  /**
   * Admin: returns all soft-deleted audits (for the restore UI).
   */
  listDeleted: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const all = await getAllAuditsIncludeDeleted();
    return all
      .filter(a => a.deletedAt !== null)
      .map(a => ({
        id: a.id,
        refNumber: a.refNumber,
        topic: a.topic,
        category: a.category,
        status: a.status,
        submitterName: a.submitterName,
        deletedAt: a.deletedAt,
      }));
  }),

  /** Admin: returns ALL consultant roster entries (active + inactive) */
  rosterAll: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getAllConsultantNames();
  }),

  /** Admin: update a consultant roster entry */
  rosterUpdate: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().max(64).nullable().optional(),
      fullName: z.string().min(2).max(255).optional(),
      grade: z.string().max(128).nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateConsultantName(input.id, { title: input.title, fullName: input.fullName, grade: input.grade });
      return { success: true };
    }),

  /** Admin: deactivate (soft-delete) a consultant roster entry */
  rosterDeactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await deactivateConsultantName(input.id);
      return { success: true };
    }),

  /** Admin: reactivate a deactivated consultant roster entry */
  rosterReactivate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await reactivateConsultantName(input.id);
      return { success: true };
    }),

  /** ADMIN-ONLY: Returns all audits each with their full audit trail — used for PDF export */
  listWithHistory: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const all = await getAllAudits();
    const withHistory = await Promise.all(
      all.map(async (a) => ({
        ...a,
        collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
        history: await getAuditEvents(a.id),
      }))
    );
    return withHistory;
  }),

  /** Fetch all comments for a given audit */
  comments: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ input, ctx }) => {
      const actor = await getUserById(ctx.user.id);
      if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      // Only the submitter, assigned supervisor, or admin can read comments.
      // supervisorId is a consultantNames.id; compare against actor.linkedConsultantId (not actor.id).
      const isAllowed =
        actor.auditRole === "admin" ||
        audit.submittedById === actor.id ||
        (actor.linkedConsultantId !== null && actor.linkedConsultantId !== undefined && audit.supervisorId === actor.linkedConsultantId);
      if (!isAllowed) throw new TRPCError({ code: "FORBIDDEN" });
      return getAuditComments(input.auditId);
    }),

  /** Return specialty-specific audit standard presets */
  standardPresets: protectedProcedure
    .input(z.object({ specialty: z.string() }))
    .query(({ input }) => {
      return getStandardPresets(input.specialty);
    }),

  /** Search audits by reference number or title (for re-audit linking) */
  searchByRef: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const all = await getAllAudits();
      const q = input.query.toLowerCase();
      return all
        .filter(
          (a) =>
            a.status !== "draft" &&
            (a.refNumber?.toLowerCase().includes(q) ||
              a.topic?.toLowerCase().includes(q))
        )
        .slice(0, 10)
        .map((a) => ({
          id: a.id,
          refNumber: a.refNumber,
          topic: a.topic ?? "",
          status: a.status,
          submitterName: a.submitterName ?? "",
        }));
    }),

  /** Post a new comment on an audit */
  addComment: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        body: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getUserById(ctx.user.id);
      if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      // Only the submitter, assigned supervisor, or admin can comment.
      // supervisorId is a consultantNames.id; compare against actor.linkedConsultantId (not actor.id).
      const isAllowed =
        actor.auditRole === "admin" ||
        audit.submittedById === actor.id ||
        (actor.linkedConsultantId !== null && actor.linkedConsultantId !== undefined && audit.supervisorId === actor.linkedConsultantId);
      if (!isAllowed) throw new TRPCError({ code: "FORBIDDEN" });

      const comment = await createAuditComment({
        auditId: input.auditId,
        authorId: actor.id,
        authorName: actor.fullName ?? actor.name ?? actor.email ?? "Unknown",
        authorRole: actor.auditRole,
        body: input.body,
      });

      // Record in audit trail
      await createAuditEvent({
        auditId: input.auditId,
        actorId: actor.id,
        actorName: actor.fullName ?? actor.name ?? actor.email ?? "Unknown",
        eventType: "comment",
        detail: input.body.length > 120 ? input.body.slice(0, 120) + "…" : input.body,
      });

      return comment;
    }),

  /**
   * Public (unauthenticated) status lookup by reference number.
   * Returns ONLY: refNumber, status, decidedAt, category.
   * Rate-limited separately in index.ts (10/min/IP).
   */
  publicStatus: publicProcedure
    .input(z.object({ ref: z.string().min(1).max(64).trim() }))
    .query(async ({ input }) => {
      const audit = await getAuditPublicStatus(input.ref.toUpperCase());
      if (!audit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No audit found with that reference number." });
      }
      // Return ONLY the safe public fields — never description, emails, or decision notes
      return {
        refNumber: audit.refNumber,
        status: audit.status,
        decidedAt: audit.decidedAt ?? null,
        category: audit.category ?? null,
      };
    }),
});

// ─── Users Router ─────────────────────────────────────────────────────────────

const usersRouter = router({
  pendingCount: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const pending = await getPendingUsers();
    return pending.length;
  }),

  pending: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getPendingUsers();
  }),

  all: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getAllUsers();
  }),

  approve: protectedProcedure
    .input(z.object({
      userId: z.number(),
      /** For consultant accounts: link to a seeded consultant record by id */
      linkedConsultantId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const admin = await getUserById(ctx.user.id);
      if (!admin || admin.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      // Fetch the target user before approval so we can send them a notification
      const targetUser = await getUserById(input.userId);
      await approveUser(input.userId, input.linkedConsultantId);

      // Notify the approved consultant so they know to log back in
      if (targetUser && targetUser.auditRole === "consultant") {
        await createNotification({
          recipientId: targetUser.id,
          userId: admin.id,
          type: "account_approved",
          message: `Your consultant account has been approved. You can now log in and access the full AuditFlow ENT system.`,
        });
        // Also push a notification to the project owner as a confirmation audit trail
        try {
          await notifyOwner({
            title: "Consultant Account Approved",
            content: `${targetUser.title ? targetUser.title + " " : ""}${targetUser.fullName ?? targetUser.name ?? "A consultant"} (${targetUser.email}) has been approved as a consultant on AuditFlow ENT QAH.`,
          });
        } catch {
          logger.warn("[Approve] Failed to send owner push notification for consultant approval");
        }
      }

      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await rejectUser(input.userId);
      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(z.object({ userId: z.number(), auditRole: z.enum(["clinician", "consultant", "admin"]) }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateUserRole(input.userId, input.auditRole);
      return { success: true };
    }),

  /**
   * Admin: update or clear the linkedConsultantId for a user account.
   * Pass linkedConsultantId: null to unlink.
   */
  updateLinkedConsultant: protectedProcedure
    .input(z.object({
      userId: z.number(),
      linkedConsultantId: z.number().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const admin = await getUserById(ctx.user.id);
      if (!admin || admin.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateLinkedConsultant(input.userId, input.linkedConsultantId);
      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return searchUsersByName(input.query);
    }),

  /** Returns the current user's full profile */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }),

  /** Updates the current user's personal details */
  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(2).max(255).optional(),
        title: z.string().max(64).optional(),
        email: z.string().email().optional(),
        grade: z.string().min(1).max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Email uniqueness check
      if (input.email) {
        const existing = await getUserByEmail(input.email);
        if (existing && existing.id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "This email address is already in use by another account." });
        }
      }
      await updateUserProfile(ctx.user.id, input);
      const updated = await getUserById(ctx.user.id);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      const { passwordHash: _ph, ...safe } = updated;
      return safe;
    }),

  /** Changes the current user's password after verifying the current one */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "New password must be at least 8 characters."),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (!user.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password change is not available for this account type." });
      }
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
      }
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await updateUserPassword(ctx.user.id, newHash);
      return { success: true };
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────

const notificationsRouter = router({
  unread: protectedProcedure.query(async ({ ctx }) => {
    return getUnreadNotifications(ctx.user.id);
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});

// ─── Admin Router ─────────────────────────────────────────────────────

const adminRouter = router({
  /** High-level counts: total, pending, approved, rejected, drafts */
  overviewStats: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
    return getAdminOverviewStats();
  }),

  /** Per-consultant audit workload table */
  auditsPerConsultant: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
    return getAuditsPerConsultant();
  }),

  /** Audits with auditEndDate within the next 30 days */
  approachingDeadlines: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
    const raw = await getApproachingDeadlines(30);
    return raw.map(a => ({
      id: a.id,
      refNumber: a.refNumber,
      topic: a.topic,
      category: a.category,
      supervisorName: a.supervisorName,
      submitterName: a.submitterName,
      status: a.status,
      priority: a.priority,
      auditEndDate: a.auditEndDate,
      daysRemaining: a.auditEndDate
        ? Math.ceil((new Date(a.auditEndDate).getTime() - Date.now()) / 86400000)
        : null,
    }));
  }),

  /** Most recent 10 submitted audits across all users */
  recentRegistrations: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || user.auditRole !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
    const raw = await getRecentRegistrations(10);
    return raw.map(a => ({
      id: a.id,
      refNumber: a.refNumber,
      topic: a.topic,
      category: a.category,
      supervisorName: a.supervisorName,
      submitterName: a.submitterName,
      status: a.status,
      priority: a.priority,
      submittedAt: a.submittedAt,
    }));
  }),
});

// ─── App Router ─────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  audits: auditRouter,
  users: usersRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;