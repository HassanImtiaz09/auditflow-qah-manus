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

## Content Update

- [x] Submit Audit — seed 14 named QAH ENT consultants as pre-approved database accounts; dropdown shows name + specialty

## Profile Settings Page

- [x] Profile — tRPC procedure: users.getProfile (returns current user's full profile)
- [x] Profile — tRPC procedure: users.updateProfile (fullName, title, email, grade)
- [x] Profile — tRPC procedure: users.changePassword (currentPassword, newPassword)
- [x] Profile — validate email uniqueness on update
- [x] Profile — validate currentPassword before allowing change
- [x] Profile — ProfileSettings page at /profile with personal details form and password change section
- [x] Profile — sidebar nav link to /profile (visible to all users)
- [x] Profile — vitest tests for updateProfile and changePassword procedures

## Round 7 — Multi-Step Audit Registration Wizard & Drafts

### Schema / Backend
- [x] Extend audits table: add all clinical audit registration fields (54 columns total)
- [x] Add status value 'draft' to audits table status enum
- [x] Migrate DB with pnpm db:push
- [x] Add/update DB helpers: getMyDraftAudits, deleteAudit
- [x] tRPC procedure: audits.getDraft, myDrafts, updateDraft, deleteDraft, submitDraft
- [x] tRPC procedure: audits.updateDraft (owner-only, records draft_saved event)
- [x] tRPC procedure: audits.deleteDraft (owner-only)
- [x] tRPC procedure: audits.myDrafts (returns all drafts for current user)
- [x] tRPC procedure: audits.submitDraft (promotes draft to pending, triggers audit trail + admin notification)

### Frontend — Multi-Step Wizard
- [x] Refactor SubmitAudit.tsx into a multi-step wizard component
- [x] Step 1: Basic details (audit title, service/specialty, supervising consultant)
- [x] Step 2: Full audit registration form (all fields from clinical-audit-form.docx)
  - [x] Reason for Audit (checkboxes: National/Regional/Local priorities + Other)
  - [x] CQC Regulation field
  - [x] Support Required (checkboxes)
  - [x] Start Date / End Date
  - [x] Audit Objectives (textarea)
  - [x] Who will be involved and their role (textarea)
  - [x] Audit Standards table (dynamic rows: standard, criteria, compliance %, exceptions)
  - [x] Evidence base for standards (textarea)
  - [x] Stakeholders (textarea + informed checkbox)
  - [x] Data Source (checkboxes)
  - [x] Data Collection Method (textarea)
  - [x] Data Collection Timing (retrospective/prospective radio)
  - [x] Data Collected By (text)
  - [x] Sample Size (text)
  - [x] Sampling Method (text)
  - [x] Data Analysis description (textarea)
  - [x] Data Analysed By (text)
  - [x] Results Presentation (checkboxes: stakeholders, care team, service users, etc.)
  - [x] Action Plan Owner (text)
  - [x] Barriers to Change (textarea)
  - [x] Re-audit Timeline (radio: N/A, 6 months, 12 months, Other)
- [x] Step 3 (Review): Summary of all entered details, read-only, with 'Edit' links back to each section
- [x] 'Save as Draft' button on all steps — saves progress without submitting
- [x] 'Review and Submit' button on Step 2 — navigates to Step 3 summary
- [x] 'Submit Now' button on Step 3 — submits the audit
- [x] Progress indicator (step 1 / 2 / 3) at top of wizard

### Frontend — Dashboard Drafts Section
- [x] Dashboard: 'My Drafts' section showing draft audits with title, last-saved date
- [x] Draft card: 'Continue Editing' button navigates to SubmitAudit wizard pre-filled with draft data
- [x] Draft card: 'Delete' button with confirmation dialog
- [x] Empty state when no drafts exist

## Round 8 — Standards Auto-complete, PDF Export, Re-audit Linking

### Standards Auto-complete
- [x] Create shared/auditStandards.ts with specialty-keyed NICE/RCSENG standard presets (Head and Neck, Otology, Rhinology, Paediatric)
- [x] tRPC procedure: audits.standardPresets(specialty) — returns preset standards for a given specialty
- [x] Step 2 wizard: "Load Presets" button above audit standards table — fetches presets and pre-populates rows
- [x] Step 2 wizard: "Load Preset" button opens Command popover filtered by consultant specialty

### Re-audit Linking
- [x] Schema: add linkedAuditId (int, nullable FK to audits.id) and linkedAuditRef (text, nullable) to audits table
- [x] Migrate DB with pnpm db:push
- [x] tRPC procedure: audits.searchByRef(query) — returns matching audits by ref number or title (for search field)
- [x] Step 1 wizard: when reaudit === "Yes", show a search-by-ref combobox to select the parent audit
- [x] Audit Registry: show linked parent ref as a badge/link in the expanded row

### PDF Registration Form Export
- [x] Step 3 review: "Download Registration Form" button generates a formatted PDF matching QAH clinical audit registration form layout
- [x] PDF includes: all Step 1 and Step 2 fields, audit standards table, submitter details, date generated
- [x] PDF uses jsPDF (already installed) with QAH branding header

### Tests
- [x] Vitest tests for audits.standardPresets procedure
- [x] Vitest tests for audits.searchByRef procedure
