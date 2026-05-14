/**
 * storageProxy.ts
 *
 * Serves files stored in Manus S3 via a signed-URL redirect, with
 * authentication and per-resource authorization enforced before any
 * Forge API call is made.
 *
 * KEY-PREFIX CONVENTION
 * ─────────────────────
 * All keys written to storage MUST use one of the following prefixes so
 * this proxy can apply the correct authorization policy:
 *
 *   audit-pdf/{auditId}/...   — audit registration PDFs
 *     Allowed: the audit's submitter, the assigned supervisor
 *              (user.linkedConsultantId === audit.supervisorId), or any admin.
 *
 *   (anything else)           — admin-only for now.
 *
 * When adding a new resource type, add a new prefix entry here and in
 * the `authorizeKey` function below.
 */

import type { Express, Request, Response } from "express";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { getUserByOpenId, getAuditById } from "../db";
import type { User } from "../../drizzle/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const NHS_COOKIE = "nhs_audit_session";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Parse and verify the nhs_audit_session JWT from the Cookie header.
 * Returns the openId claim on success, null on any failure.
 */
async function verifySessionCookie(cookieHeader: string | undefined): Promise<string | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(NHS_COOKIE + "="));
  if (!match) return null;
  const token = match.slice(NHS_COOKIE.length + 1);
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.openId as string) ?? null;
  } catch {
    return null;
  }
}

// ─── Authorization ────────────────────────────────────────────────────────────

/**
 * Decide whether `user` is allowed to access `key`.
 *
 * Returns true if access is granted, false otherwise.
 */
async function authorizeKey(user: User, key: string): Promise<boolean> {
  // Admins can access everything.
  if (user.role === "admin" || user.auditRole === "admin") return true;

  // audit-pdf/{auditId}/... — submitter or assigned supervisor only.
  const auditPdfMatch = key.match(/^audit-pdf\/(\d+)\//);
  if (auditPdfMatch) {
    const auditId = parseInt(auditPdfMatch[1], 10);
    if (isNaN(auditId)) return false;

    const audit = await getAuditById(auditId);
    if (!audit) return false;

    // Submitter check
    if (audit.submittedById === user.id) return true;

    // Assigned supervisor check: user's linkedConsultantId must match audit.supervisorId
    if (
      user.linkedConsultantId !== null &&
      user.linkedConsultantId !== undefined &&
      audit.supervisorId !== null &&
      user.linkedConsultantId === audit.supervisorId
    ) {
      return true;
    }

    return false;
  }

  // All other key prefixes: admin-only (already handled above).
  return false;
}

// ─── Route handler ────────────────────────────────────────────────────────────

async function handleStorageRequest(req: Request, res: Response): Promise<void> {
  const key = (req.params as Record<string, string>)[0];
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  // ── Step 1: Authenticate ──────────────────────────────────────────────────
  const openId = await verifySessionCookie(req.headers.cookie);
  if (!openId) {
    res.status(401).send("Unauthorized");
    return;
  }

  const user = await getUserByOpenId(openId);
  if (!user) {
    res.status(401).send("Unauthorized");
    return;
  }

  // ── Step 2: Authorize ─────────────────────────────────────────────────────
  const allowed = await authorizeKey(user, key);
  if (!allowed) {
    res.status(403).send("Forbidden");
    return;
  }

  // ── Step 3: Proxy to Forge presign endpoint ───────────────────────────────
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }

  try {
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
    );
    forgeUrl.searchParams.set("path", key);

    const forgeResp = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });

    if (!forgeResp.ok) {
      const body = await forgeResp.text().catch(() => "");
      console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
      res.status(502).send("Storage backend error");
      return;
    }

    const { url } = (await forgeResp.json()) as { url: string };
    if (!url) {
      res.status(502).send("Empty signed URL from backend");
      return;
    }

    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage proxy error");
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", handleStorageRequest);
}

// ─── Exports for testing ──────────────────────────────────────────────────────

export { verifySessionCookie, authorizeKey };
