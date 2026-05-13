import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

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
  getAdminUser,
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
  deleteAudit,
  getAuditsForConsultantAll,
  getUserByLinkedConsultantId,
  updateLinkedConsultant,
  getConsultantNames,
  addConsultantName,
} from "./db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { getStandardPresets } from "../shared/auditStandards";
import { notifyOwner } from "./_core/notification";

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
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const isConsultant = input.grade === "Consultant" || input.grade === "Associate Specialist";
      const auditRole = isConsultant ? "consultant" : "clinician";
      const approved = !isConsultant;
      const roleApproved = !isConsultant;

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
      });

      const newUser = await getUserByEmail(input.email);
      if (!newUser) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed." });

      if (isConsultant) {
        const admin = await getAdminUser();
        if (admin) {
          // In-app notification for admin
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
          console.warn("[Register] Failed to send owner push notification for consultant registration");
        }
      }

      return { success: true, pending: isConsultant };
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
          role: user.role,
        },
      };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Always return success to prevent email enumeration
      const user = await getUserByEmail(input.email);
      if (!user) return { success: true };

      // Generate a cryptographically secure random token
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await createPasswordResetToken(user.id, token, expiresAt);

      // Return the reset token so the admin can share the link with the user
      // (No external email service is configured; the link is shown on-screen)
      return { success: true, token };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const record = await getPasswordResetToken(input.token);
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

const auditRouter = router({
  list: protectedProcedure.query(async () => {
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
        .filter((a) => a.status === "pending")
        .map((a) => ({ ...a, collaborators: a.collaborators ? JSON.parse(a.collaborators) : [] }));
    }
    if (user.auditRole === "consultant") {
      const mine = await getAuditsForConsultant(user.id);
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

  /** Delete a draft audit (owner only) */
  deleteDraft: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const audit = await getAuditById(input.auditId);
      if (!audit) throw new TRPCError({ code: "NOT_FOUND" });
      if (audit.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (audit.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft audits can be deleted." });
      await deleteAudit(input.auditId);
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
        collaborators: z.array(z.string()).optional(),
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
          const sup = await getUserById(supervisorId);
          supervisorName = sup ? (sup.fullName ?? sup.name ?? null) : null;
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

      // Notify admin
      const admin = await getAdminUser();
      if (admin) {
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
        collaborators: z.array(z.string()).optional(),
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

      const total = await countAudits();
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const dy = String(now.getDate()).padStart(2, "0");
      const seq = String(total + 1).padStart(4, "0");
      const refNumber = `REF-${y}${mo}${dy}-${seq}`;

      let supervisorName: string | null = null;
      if (input.supervisorId) {
        const sup = await getUserById(input.supervisorId);
        supervisorName = sup ? (sup.fullName ?? sup.name ?? null) : null;
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
        // Notify admin
        const adminUser = await getAdminUser();
        if (adminUser) {
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
      }

      return { success: true, refNumber, audit };
    }),

  decide: protectedProcedure
    .input(
      z.object({
        auditId: z.number(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || (user.auditRole !== "consultant" && user.auditRole !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Consultants may only decide on audits explicitly assigned to them as supervisor
      if (user.auditRole === "consultant") {
        const audit = await getAuditById(input.auditId);
        if (!audit || audit.supervisorId !== user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not the assigned supervisor for this audit." });
        }
      }
      const auditForDecide = await getAuditById(input.auditId);
      await updateAudit(input.auditId, {
        status: input.decision,
        decisionNote: input.note ?? null,
        decidedById: user.id,
        decidedAt: new Date(),
      });
      // Record audit trail event
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: input.decision,
        detail: input.note ?? null,
      });
      // Notify the submitter of the decision
      if (auditForDecide && auditForDecide.submittedById) {
        const deciderName = user.fullName ?? user.name ?? "Your supervisor";
        const refNum = auditForDecide.refNumber;
        const noteText = input.note ? ` Note: "${input.note}"` : "";
        const msgVerb = input.decision === "approved" ? "approved" : "rejected";
        await createNotification({
          recipientId: auditForDecide.submittedById,
          userId: user.id,
          type: input.decision === "approved" ? "audit_approved" : "audit_rejected",
          message: `Your audit ${refNum} has been ${msgVerb} by ${deciderName}.${noteText}`,
        });
      }
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ auditId: z.number(), archived: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateAudit(input.auditId, { archived: input.archived });
      // Record audit trail event
      await createAuditEvent({
        auditId: input.auditId,
        actorId: user.id,
        actorName: user.fullName ?? user.name ?? "Unknown",
        eventType: input.archived ? "archived" : "unarchived",
        detail: null,
      });
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
        const sup = await getUserById(input.supervisorId);
        if (!sup || (sup.auditRole !== "consultant" && sup.auditRole !== "admin")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid consultant selected." });
        }
        supervisorName = sup.fullName ?? sup.name ?? null;
      }
      const auditForReassign = await getAuditById(input.auditId);
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
      // Notify the newly assigned consultant (if any)
      if (input.supervisorId !== null && auditForReassign) {
        const adminName = user.fullName ?? user.name ?? "An administrator";
        const refNum = auditForReassign.refNumber;
        await createNotification({
          recipientId: input.supervisorId,
          userId: user.id,
          type: "audit_reassigned",
          message: `${adminName} has assigned audit ${refNum} to you for review.`,
        });
      }
      return { success: true };
    }),

  history: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ input }) => {
      return getAuditEvents(input.auditId);
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
    // supervisorId on audits refers to the seeded consultant record's id.
    // For a linked consultant account, use linkedConsultantId to look up their seeded record.
    // For admin, fall back to user.id (admins are not linked to seeded consultants).
    const lookupId = user.auditRole === "consultant" && user.linkedConsultantId
      ? user.linkedConsultantId
      : user.id;
    const all = await getAuditsForConsultantAll(lookupId);
    const mapped = all.map((a) => ({
      ...a,
      collaborators: a.collaborators ? JSON.parse(a.collaborators) : [],
    }));
    return {
      pending: mapped.filter((a) => a.status === "pending"),
      approved: mapped.filter((a) => a.status === "approved"),
      rejected: mapped.filter((a) => a.status === "rejected"),
    };
  }),

  /** Returns all audits each with their full audit trail — used for PDF export */
  listWithHistory: protectedProcedure.query(async () => {
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
      // Only the submitter, assigned supervisor, or admin can read comments
      const isAllowed =
        actor.auditRole === "admin" ||
        audit.submittedById === actor.id ||
        audit.supervisorId === actor.id;
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
      // Only the submitter, assigned supervisor, or admin can comment
      const isAllowed =
        actor.auditRole === "admin" ||
        audit.submittedById === actor.id ||
        audit.supervisorId === actor.id;
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
});

// ─── Users Router ─────────────────────────────────────────────────────────────

const usersRouter = router({
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
          console.warn("[Approve] Failed to send owner push notification for consultant approval");
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

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  audits: auditRouter,
  users: usersRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
