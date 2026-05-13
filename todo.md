# AuditFlow QAH - Project TODO

## Core Features

- [x] Password authentication — registration and login with bcrypt-hashed passwords
- [x] Supervising consultant assignment — audit submission form allows selecting an approved consultant as supervisor; only that consultant sees the audit in their Approval Queue
- [x] Admin user search by name — Account Lookup utility on User Management page to find registered users by name (useful when someone can't remember their email)
- [x] User registration with grade/role selection
- [x] Consultant-grade accounts require admin approval before accessing Approval Queue
- [x] User Approvals page for admin to approve/reject consultant registrations
- [x] Submit Audit form with full audit details
- [x] Approval Queue for consultants to approve/reject audits assigned to them
- [x] Audit Registry (list of all submitted audits)
- [x] Audit Calendar view
- [x] Statistics page
- [x] Export Data page
- [x] Settings page
- [x] Decision Log
- [x] User Management page with role change capability
- [x] Sign out functionality
- [x] Session cookie aligned with COOKIE_NAME constant (nhs_audit_session)
- [x] Vitest tests passing (auth.logout test)

## New Features (Round 2)

- [x] Audit visibility scoping — enforce supervisor ownership check in decide mutation (consultant can only approve/reject audits assigned to them)
- [x] Password reset flow — add passwordResetTokens table to schema (db:push applied)
- [x] Password reset flow — add requestReset and resetPassword tRPC procedures
- [x] Password reset flow — add Forgot password? link on login page
- [x] Password reset flow — build /forgot-password and /reset-password pages
- [x] Password reset flow — write vitest tests for reset procedures (6 tests passing)

## New Features (Round 3)

- [x] Audit re-assignment — admin control to change the assigned supervisor on a pending audit (tRPC procedure + UI in Audit Registry)
- [x] Approval Queue badge — show pending audit count badge on sidebar nav item for the logged-in consultant
- [x] Password strength indicator — visual strength meter on Register and ResetPassword forms
- [x] Fix authentication context — context.ts now uses NHS JWT verification for protectedProcedure (was using Manus OAuth SDK which rejected NHS tokens)
- [x] Fix session expiry redirect — getLoginUrl() now returns /login instead of Manus OAuth portal

## New Features (Round 4)

- [x] Audit trail — add auditEvents table to schema (auditId, actorId, actorName, eventType, detail, createdAt)
- [x] Audit trail — migrate DB with pnpm db:push
- [x] Audit trail — add DB helpers: createAuditEvent, getAuditEvents
- [x] Audit trail — add tRPC procedure: audits.history (returns events for a given auditId)
- [x] Audit trail — record event on audit submit (submitted)
- [x] Audit trail — record event on decide mutation (approved / rejected)
- [x] Audit trail — record event on reassign mutation (reassigned)
- [x] Audit trail — record event on archive mutation (archived / unarchived)
- [x] Audit trail — Audit Registry detail panel: clicking a row expands a history timeline
- [x] Audit trail — write vitest tests for history procedure

## New Features (Round 5)

- [x] Reassign notification — when admin reassigns an audit, send in-app notification to the newly assigned consultant
- [x] Decide note field — align Approval Queue UI to pass `note` (not `comment`) to the decide mutation
- [x] Decide note UI — add a text area in the Approval Queue approve/reject dialog so consultants can record a formal decision rationale
- [x] Decision note appears in audit trail detail field
- [x] Submitter notification on decide — when an audit is approved or rejected, notify the submitter via the notifications table
- [x] PDF export with audit trail — add a "Export PDF" button in Audit Registry that generates a per-audit PDF including full audit trail
- [x] Vitest tests for Round 5 backend changes (reassign notification, decide notification)

## New Features (Round 6)

- [x] Comment thread — add auditComments table to schema (auditId, authorId, authorName, authorRole, body, createdAt)
- [x] Comment thread — migrate DB with pnpm db:push
- [x] Comment thread — add DB helpers: createAuditComment, getAuditComments
- [x] Comment thread — tRPC procedures: audits.addComment (protected, submitter/supervisor/admin only), audits.comments (protected)
- [x] Comment thread — record each new comment as an audit trail event (eventType: "comment")
- [x] Comment thread — embed CommentThread component in Audit Registry expanded row (below history timeline)
- [x] Comment thread — embed CommentThread component in Check Status page (submitter view)
- [x] Comment thread — real-time optimistic update on post (new comment appears immediately)
- [x] Dashboard home — replace Home.tsx landing with personal dashboard
- [x] Dashboard home — show recent submissions card (last 5 audits by current user, with status badge)
- [x] Dashboard home — show unread notifications card (up to 5, with mark-all-read)
- [x] Dashboard home — show quick stats (total submitted, pending, approved, rejected)
- [x] Dashboard home — CTA button linking to Submit Audit form
- [x] Vitest tests for audits.addComment and audits.comments procedures
