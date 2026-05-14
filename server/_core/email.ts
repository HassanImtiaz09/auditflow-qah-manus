/**
 * Outbound email helper for AuditFlow QAH.
 *
 * Priority order:
 *   1. Resend API (RESEND_API_KEY) — preferred, no SMTP setup needed
 *   2. SMTP / nodemailer (SMTP_HOST + credentials) — fallback
 *   3. If neither is configured, logs a warning and returns false
 *
 * The caller can check the return value to decide whether to show
 * an on-screen fallback link.
 */
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { ENV } from "./env";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!ENV.resendApiKey) return null;
  if (!_resend) _resend = new Resend(ENV.resendApiKey);
  return _resend;
}

let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!ENV.smtpHost) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpSecure,
    auth: ENV.smtpUser ? { user: ENV.smtpUser, pass: ENV.smtpPass } : undefined,
  });
  return _transporter;
}

/**
 * Send a single email.
 * Returns true on success, false when no email provider is configured
 * or the upstream service rejects the message.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // 1. Try Resend
  const resend = getResend();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: ENV.resendFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (error) {
        console.warn(`[Email/Resend] Failed to send to ${payload.to}:`, error);
        // Fall through to SMTP
      } else {
        console.info(`[Email/Resend] Sent "${payload.subject}" to ${payload.to}`);
        return true;
      }
    } catch (err) {
      console.warn(`[Email/Resend] Exception sending to ${payload.to}:`, err);
      // Fall through to SMTP
    }
  }

  // 2. Try SMTP
  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: ENV.smtpFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      console.info(`[Email/SMTP] Sent "${payload.subject}" to ${payload.to}`);
      return true;
    } catch (err) {
      console.warn(`[Email/SMTP] Failed to send to ${payload.to}:`, err);
      return false;
    }
  }

  // 3. No provider configured
  console.warn(
    `[Email] No email provider configured — skipping email to ${payload.to}: "${payload.subject}"`
  );
  return false;
}

// ─── Email template builder ───────────────────────────────────────────────────

interface AuditEmailContext {
  refNumber: string;
  topic: string;
  submitterName: string;
  actorName: string;
  decision: "approved" | "rejected" | "reassigned" | "archived" | "unarchived";
  note?: string | null;
  newSupervisorName?: string | null;
}

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  body { margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background:#f4f6f9; }
  .wrapper { max-width:600px; margin:32px auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
  .header { background:#003366; padding:24px 32px; }
  .header h1 { margin:0; color:#ffffff; font-size:18px; font-weight:700; }
  .header p { margin:4px 0 0; color:#a8c4e0; font-size:13px; }
  .body { padding:28px 32px; }
  .body p { margin:0 0 14px; font-size:14px; color:#333333; line-height:1.6; }
  .audit-box { background:#f0f4fa; border-left:4px solid #003366; border-radius:4px; padding:14px 18px; margin:18px 0; }
  .audit-box .ref { font-size:12px; color:#6b7280; margin:0 0 4px; }
  .audit-box .title { font-size:15px; font-weight:700; color:#003366; margin:0; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; }
  .badge-approved { background:#d1fae5; color:#065f46; }
  .badge-rejected { background:#fee2e2; color:#991b1b; }
  .badge-reassigned { background:#ede9fe; color:#5b21b6; }
  .badge-archived { background:#f3f4f6; color:#374151; }
  .badge-unarchived { background:#f3f4f6; color:#374151; }
  .note-box { background:#fffbeb; border:1px solid #fcd34d; border-radius:4px; padding:12px 16px; margin:14px 0; font-size:13px; color:#92400e; }
  .footer { padding:16px 32px; background:#f9fafb; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>AuditFlow QAH</h1>
    <p>Portsmouth Hospitals University NHS Trust — ENT Department</p>
  </div>
  <div class="body">
    <h2 style="margin:0 0 16px;font-size:16px;color:#111827;">${title}</h2>
    ${bodyHtml}
  </div>
  <div class="footer">
    This is an automated message from AuditFlow QAH. Please do not reply to this email.
    If you believe you received this in error, please contact your department audit lead.
  </div>
</div>
</body>
</html>`;
}

export function buildAuditStatusEmail(
  ctx: AuditEmailContext,
  recipientName: string
): { subject: string; html: string; text: string } {
  const { refNumber, topic, actorName, decision, note, newSupervisorName } = ctx;

  const badgeClass = `badge badge-${decision}`;
  const decisionLabel =
    decision === "approved"    ? "Approved"
    : decision === "rejected"  ? "Rejected"
    : decision === "reassigned" ? "Reassigned"
    : decision === "archived"  ? "Archived"
    : "Restored";

  const auditBox = `
    <div class="audit-box">
      <p class="ref">Audit Reference: ${refNumber}</p>
      <p class="title">${topic}</p>
    </div>`;

  let bodyHtml = `<p>Dear ${recipientName},</p>`;
  let subject = "";
  let plainText = "";

  if (decision === "approved") {
    subject = `[AuditFlow] Audit ${refNumber} has been approved`;
    bodyHtml += `
      <p>Your audit registration has been <span class="${badgeClass}">${decisionLabel}</span> by <strong>${actorName}</strong>.</p>
      ${auditBox}`;
    plainText = `Your audit ${refNumber} ("${topic}") has been approved by ${actorName}.`;
  } else if (decision === "rejected") {
    subject = `[AuditFlow] Audit ${refNumber} has been rejected`;
    bodyHtml += `
      <p>Your audit registration has been <span class="${badgeClass}">${decisionLabel}</span> by <strong>${actorName}</strong>.</p>
      ${auditBox}`;
    plainText = `Your audit ${refNumber} ("${topic}") has been rejected by ${actorName}.`;
  } else if (decision === "reassigned") {
    subject = `[AuditFlow] Audit ${refNumber} has been reassigned`;
    const supText = newSupervisorName
      ? `The audit has been reassigned to <strong>${newSupervisorName}</strong>.`
      : "The supervising consultant assignment has been removed.";
    bodyHtml += `
      <p>An update has been made to the following audit by <strong>${actorName}</strong>:</p>
      ${auditBox}
      <p>${supText}</p>`;
    plainText = `Audit ${refNumber} ("${topic}") has been reassigned by ${actorName}. ${newSupervisorName ? `New supervisor: ${newSupervisorName}.` : "Supervisor removed."}`;
  } else if (decision === "archived") {
    subject = `[AuditFlow] Audit ${refNumber} has been archived`;
    bodyHtml += `
      <p>The following audit has been <span class="${badgeClass}">${decisionLabel}</span> by <strong>${actorName}</strong>.</p>
      ${auditBox}
      <p>Archived audits are hidden from the active registry but remain accessible to administrators.</p>`;
    plainText = `Audit ${refNumber} ("${topic}") has been archived by ${actorName}.`;
  } else {
    subject = `[AuditFlow] Audit ${refNumber} has been restored`;
    bodyHtml += `
      <p>The following audit has been <span class="${badgeClass}">Restored</span> by <strong>${actorName}</strong> and is now active again.</p>
      ${auditBox}`;
    plainText = `Audit ${refNumber} ("${topic}") has been restored by ${actorName}.`;
  }

  if (note) {
    bodyHtml += `<div class="note-box"><strong>Note from ${actorName}:</strong> ${note}</div>`;
    plainText += ` Note: "${note}"`;
  }

  bodyHtml += `<p style="margin-top:20px;font-size:13px;color:#6b7280;">
    Please log in to <a href="https://auditqah-436kjx9h.manus.space" style="color:#003366;">AuditFlow QAH</a> to view the full audit details.
  </p>`;

  return { subject, html: baseTemplate(subject, bodyHtml), text: plainText };
}

// ─── Collaborator type ────────────────────────────────────────────────────────

export interface CollaboratorEntry {
  name: string;
  email: string;
}

export function parseCollaborators(raw: string | null | undefined): CollaboratorEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CollaboratorEntry =>
        typeof c === "object" && c !== null && typeof c.email === "string" && c.email.includes("@")
    );
  } catch {
    return [];
  }
}

/**
 * Send audit status notification emails to all relevant parties:
 *  - The submitter (if they have an email)
 *  - Each collaborator with a valid email
 *  - The acting consultant/admin (if they have an email and are different from the submitter)
 *
 * Failures are logged but never throw — email is best-effort.
 */
export async function sendAuditStatusEmails(opts: {
  audit: {
    refNumber: string;
    topic: string | null;
    submitterName: string | null;
    submitterEmail: string | null;
    collaborators: string | null;
  };
  decision: AuditEmailContext["decision"];
  actorName: string;
  actorEmail?: string | null;
  note?: string | null;
  newSupervisorName?: string | null;
}): Promise<void> {
  const { audit, decision, actorName, actorEmail, note, newSupervisorName } = opts;

  const ctx: AuditEmailContext = {
    refNumber: audit.refNumber,
    topic: audit.topic ?? "Untitled Audit",
    submitterName: audit.submitterName ?? "Auditor",
    actorName,
    decision,
    note,
    newSupervisorName,
  };

  const recipients: { name: string; email: string }[] = [];

  // 1. Submitter
  if (audit.submitterEmail) {
    recipients.push({
      name: audit.submitterName ?? "Auditor",
      email: audit.submitterEmail,
    });
  }

  // 2. Collaborators
  const collabs = parseCollaborators(audit.collaborators);
  for (const c of collabs) {
    if (c.email && !recipients.find(r => r.email === c.email)) {
      recipients.push({ name: c.name || c.email, email: c.email });
    }
  }

  // 3. Acting consultant/admin (if different from submitter)
  if (actorEmail && !recipients.find(r => r.email === actorEmail)) {
    recipients.push({ name: actorName, email: actorEmail });
  }

  // Send emails concurrently (best-effort)
  await Promise.allSettled(
    recipients.map(async (r) => {
      const { subject, html, text } = buildAuditStatusEmail(ctx, r.name);
      await sendEmail({ to: r.email, subject, html, text });
    })
  );
}

// ─── Email Verification ───────────────────────────────────────────────────────

/**
 * Send an email verification link to a newly registered user.
 * The link points to /verify-email?token=<token> on the given origin.
 */
export async function sendVerificationEmail(opts: {
  to: string;
  recipientName: string;
  token: string;
  origin: string;
}): Promise<boolean> {
  const { to, recipientName, token, origin } = opts;
  const verifyUrl = `${origin}/verify-email?token=${token}`;

  const bodyHtml = `
    <p>Dear ${recipientName},</p>
    <p>Thank you for registering with <strong>AuditFlow QAH</strong> — the ENT Clinical Audit Registry at Portsmouth Hospitals University NHS Trust.</p>
    <p>Please verify your email address by clicking the button below. This link will expire in <strong>24 hours</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${verifyUrl}"
         style="display:inline-block;background:#003366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;">
        Verify Email Address
      </a>
    </div>
    <p style="font-size:12px;color:#6b7280;">If the button above does not work, copy and paste this link into your browser:</p>
    <p style="font-size:12px;word-break:break-all;color:#003366;">${verifyUrl}</p>
    <p style="font-size:12px;color:#6b7280;">If you did not create an account, you can safely ignore this email.</p>`;

  const subject = "[AuditFlow] Please verify your email address";
  return sendEmail({
    to,
    subject,
    html: baseTemplate(subject, bodyHtml),
    text: `Dear ${recipientName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
}

// ─── Registration Confirmation ────────────────────────────────────────────────

/**
 * Send a welcome / registration confirmation email to a newly registered user.
 * Sent in addition to the verification email so the user has a clear record
 * of their registration details.
 */
export async function sendRegistrationConfirmationEmail(opts: {
  to: string;
  recipientName: string;
  grade: string;
  isConsultant: boolean;
}): Promise<boolean> {
  const { to, recipientName, grade, isConsultant } = opts;

  const nextStepHtml = isConsultant
    ? `<p>As a <strong>${grade}</strong>, your account is pending approval by the department administrator.
       You will receive a further email once your consultant access has been approved.</p>`
    : `<p>Your account is now active. Please verify your email address using the link in the separate
       verification email we have just sent, then log in to start submitting clinical audits.</p>`;

  const bodyHtml = `
    <p>Dear ${recipientName},</p>
    <p>Thank you for registering with <strong>AuditFlow QAH</strong> — the ENT Clinical Audit Registry
    at Portsmouth Hospitals University NHS Trust.</p>
    <p>Your account has been created with the following details:</p>
    <div style="background:#f0f4fa;border-left:4px solid #003366;border-radius:4px;padding:14px 18px;margin:18px 0;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Registered email</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#003366;">${to}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Clinical grade</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#003366;">${grade}</p>
    </div>
    ${nextStepHtml}
    <p style="font-size:12px;color:#6b7280;">If you did not create this account, please contact your department IT lead immediately.</p>`;

  const subject = "[AuditFlow] Registration confirmed — AuditFlow QAH";
  return sendEmail({
    to,
    subject,
    html: baseTemplate(subject, bodyHtml),
    text: `Dear ${recipientName},\n\nYour AuditFlow QAH account has been created.\nEmail: ${to}\nGrade: ${grade}\n\n${isConsultant ? "Your account is pending consultant approval by the administrator." : "Please verify your email address using the link in the separate verification email, then log in."}\n\nIf you did not create this account, contact your department IT lead.`,
  });
}

// ─── Audit Submission Confirmation ───────────────────────────────────────────

/**
 * Send an audit submission confirmation email to the submitter and all collaborators.
 * Informs them that the audit has been registered and is awaiting consultant review.
 */
export async function sendAuditSubmissionEmails(opts: {
  refNumber: string;
  topic: string;
  submitterName: string;
  submitterEmail: string | null;
  supervisorName: string | null;
  collaborators: string | null; // raw JSON
}): Promise<void> {
  const { refNumber, topic, submitterName, submitterEmail, supervisorName, collaborators } = opts;

  const supervisorLine = supervisorName
    ? `<p>The audit has been assigned to <strong>${supervisorName}</strong> for review.</p>`
    : `<p>The audit is awaiting assignment to a supervising consultant.</p>`;

  const buildBody = (recipientName: string) => `
    <p>Dear ${recipientName},</p>
    <p>This is a confirmation that the following clinical audit has been successfully submitted to
    <strong>AuditFlow QAH</strong> and is now awaiting consultant review.</p>
    <div style="background:#f0f4fa;border-left:4px solid #003366;border-radius:4px;padding:14px 18px;margin:18px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Reference number</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#003366;">${refNumber}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Audit topic</p>
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#003366;">${topic}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Submitted by</p>
      <p style="margin:0;font-size:14px;color:#374151;">${submitterName}</p>
    </div>
    ${supervisorLine}
    <p>You will receive a further email when the supervising consultant has reviewed the audit.</p>
    <p style="font-size:12px;color:#6b7280;">If you believe you received this in error, please contact your department audit lead.</p>`;

  const subject = `[AuditFlow] Audit submitted — ${refNumber}: ${topic}`;

  const recipients: { name: string; email: string }[] = [];

  if (submitterEmail) {
    recipients.push({ name: submitterName, email: submitterEmail });
  }

  const collabs = parseCollaborators(collaborators);
  for (const c of collabs) {
    if (c.email && !recipients.find(r => r.email === c.email)) {
      recipients.push({ name: c.name || c.email, email: c.email });
    }
  }

  await Promise.allSettled(
    recipients.map(async (r) => {
      const html = baseTemplate(subject, buildBody(r.name));
      const text = `Dear ${r.name},\n\nAudit ${refNumber} ("${topic}") has been submitted by ${submitterName} and is awaiting consultant review.\n${supervisorName ? `Assigned to: ${supervisorName}` : "Awaiting supervisor assignment."}\n\nYou will receive a further email when the audit has been reviewed.`;
      await sendEmail({ to: r.email, subject, html, text });
    })
  );
}

// ─── Password Reset ───────────────────────────────────────────────────────────

/**
 * Send a password-reset link to the user.
 * The link points to /reset-password?token=<rawToken> on the given origin.
 * The caller is responsible for storing the HASHED token in the DB;
 * this function receives the raw (unhashed) token to embed in the URL.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  recipientName: string;
  token: string;
  origin: string;
}): Promise<boolean> {
  const { to, recipientName, token, origin } = opts;
  const resetUrl = `${origin}/reset-password?token=${token}`;

  const bodyHtml = `
    <p>Dear ${recipientName},</p>
    <p>We received a request to reset the password for your <strong>AuditFlow QAH</strong> account.</p>
    <p>Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#003366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:700;">
        Reset Password
      </a>
    </div>
    <p style="font-size:12px;color:#6b7280;">If the button above does not work, copy and paste this link into your browser:</p>
    <p style="font-size:12px;word-break:break-all;color:#003366;">${resetUrl}</p>
    <p style="font-size:12px;color:#6b7280;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>`;

  const subject = "[AuditFlow] Password reset request — AuditFlow QAH";
  return sendEmail({
    to,
    subject,
    html: baseTemplate(subject, bodyHtml),
    text: `Dear ${recipientName},\n\nTo reset your AuditFlow QAH password, visit:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, ignore this email.`,
  });
}
