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
} from "./db";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

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
          await createNotification({
            recipientId: admin.id,
            userId: newUser.id,
            type: "consultant_registered",
            message: `${input.title ? input.title + " " : ""}${input.fullName} (${input.grade}) has registered and is requesting consultant access.`,
          });
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

      if (!user.approved) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account is pending administrator approval." });
      }
      if (user.auditRole === "consultant" && !user.roleApproved) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your consultant role is awaiting administrator approval." });
      }

      
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

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
      await updateAudit(input.auditId, {
        status: input.decision,
        decisionNote: input.note ?? null,
        decidedById: user.id,
        decidedAt: new Date(),
      });
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ auditId: z.number(), archived: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateAudit(input.auditId, { archived: input.archived });
      return { success: true };
    }),

  consultants: protectedProcedure.query(async () => {
    const consultants = await getApprovedConsultants();
    return consultants.map((c) => ({
      id: c.id,
      fullName: c.fullName ?? c.name ?? "",
      grade: c.grade ?? "",
      email: c.email ?? "",
    }));
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
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await approveUser(input.userId);
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

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.auditRole !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return searchUsersByName(input.query);
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
