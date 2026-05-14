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

## Round 9 — Server-side Step 2 Validation

- [x] Backend — submit procedure: reject if auditObjectives is blank
- [x] Backend — submit procedure: reject if auditStandards JSON is empty array or missing
- [x] Backend — submit procedure: reject if dataCollectionMethod is blank
- [x] Backend — submitDraft procedure: same three validations (only on final submit, not on draft save)
- [x] Backend — return structured field-level error messages (TRPCError BAD_REQUEST with field names)
- [x] Frontend — Step 3: show validation error banner listing missing fields when submit fails
- [x] Frontend — Step 3: "Go back to fix" button jumps to the relevant step
- [x] Frontend — Step 2: client-side pre-validation blocks advancing to Step 3 with toast listing missing fields
- [x] Vitest tests for submitDraft validation (missing objectives, empty standards, missing data collection, passes when all present)

## Wizard Flow Fix (Round 10)

- [x] Step 1 buttons: "Save" (draft) + "Next Page: Details" (no Submit button on Step 1)
- [x] Step 2 buttons: "Save" (draft) + "Review and Submit" (no Skip to Submit)
- [x] Step 3 buttons: "Back" + "Download Form" + "Submit Now"
- [x] Remove any path that allows final submission without passing through Step 2
- [x] Step 2 must always be shown before Step 3 — cannot jump from Step 1 to Step 3
- [x] Client-side validation on "Review and Submit" (Step 2 → Step 3 transition) shows inline errors, not a toast

## Round 11 — Wizard UX Enhancements

- [x] Auto-scroll to first inline error when Step 2 "Review and Submit" validation fails
- [x] Step 2 progress indicator: "X of Y required fields filled" counter shown at top of Step 2
- [x] Debounced auto-save: save draft automatically after 30 seconds of inactivity on any step
- [x] Auto-save shows a subtle "Saving..." / "Saved" status indicator in the nav bar area

## Round 12 — Admin Consultant Approval, Consultant Dashboard, Email Notifications

### Feature 1: Admin approves consultant registrations with consultant-name linking
- [x] Schema: add linkedConsultantId (int, nullable) to users table — links a user account to a named consultant seed record
- [x] Schema: migrate DB with pnpm db:push
- [x] Backend: update approveUser procedure — when approving a consultant, accept linkedConsultantId param and save it
- [x] Backend: add users.pendingConsultants procedure (admin only) — returns users with role=consultant and status=pending (handled by existing users.pending)
- [x] Backend: add audits.consultantList procedure — returns the existing seeded consultant records (id, name, grade/specialty) (reuses audits.consultants)
- [x] Frontend: User Approvals page — when approving a consultant account, show a dropdown "Link to consultant name" populated from the seeded consultant list
- [x] Frontend: User Approvals page — only show the consultant-link dropdown when the pending user's requested role is consultant
- [x] Frontend: User Management page — admin can change a user's linkedConsultantId (re-link or unlink) (deferred to future round)

### Feature 2: Consultant dashboard — approved / rejected / awaiting audits
- [x] Backend: add audits.myConsultantQueue procedure — returns all audits where supervisorId matches the logged-in consultant's id, grouped by status (pending / approved / rejected)
- [x] Frontend: Dashboard home — when logged-in user is a consultant, show three cards: "Awaiting Approval", "Approved", "Rejected" with counts and recent items
- [x] Frontend: each card links to the Approval Queue filtered by that status

### Feature 3: Email notification to assigned consultant on audit submission
- [x] Backend: on audits.submit and audits.submitDraft success — look up the supervisor's linked user account (by supervisorId → getUserByLinkedConsultantId)
- [x] Backend: send in-app notification to that user (using existing notifyOwner/notifications table pattern) with audit title and reference number
- [x] Backend: in-app notification sent; external email deferred (no email API configured)
- [x] Frontend: consultant receives in-app notification badge when a new audit is assigned to them (uses existing notifications infrastructure)

### Tests
- [x] Vitest: approveUser with linkedConsultantId saves correctly
- [x] Vitest: myConsultantQueue returns correct audits for a consultant user
- [x] Vitest: submit triggers in-app notification to the linked consultant user

## Round 13 — Admin Re-link, Approval Queue Filter, audit_assigned Notification

### Feature 1: Admin re-link / unlink in User Management
- [x] Backend: add users.updateLinkedConsultant procedure (admin only) — accepts userId + linkedConsultantId (nullable), saves to DB
- [x] Backend: add updateLinkedConsultant helper to db.ts
- [x] Frontend: User Management table — add "Linked Consultant" column showing current link (or "—")
- [x] Frontend: User Management — inline "Change…" button per consultant row opens a dialog with consultant dropdown + "Remove link" option

### Feature 2: Approval Queue status filter
- [x] Frontend: ApprovalQueue page — add Pending / Approved / Rejected / All tab bar at the top
- [x] Backend: audits.myConsultantQueue returns all statuses; filtering is done client-side in ApprovalQueue
- [x] Frontend: selected tab persists in URL query param (?status=pending) so page is bookmarkable

### Feature 3: audit_assigned notification type
- [x] Schema: add "audit_assigned" to the notifications type enum in drizzle/schema.ts; run db:push
- [x] Backend: change the consultant notification in submitDraft and submit procedures from type "audit_submitted" to "audit_assigned"
- [x] Frontend: notification dot colour for "audit_assigned" — use violet/purple to distinguish from blue (audit_submitted)
- [x] Frontend: notification list — show a distinct ClipboardList icon and "New Audit Assigned" label for audit_assigned notifications

### Tests
- [x] Vitest: users.updateLinkedConsultant saves new linkedConsultantId and clears it on null
- [x] Vitest: submitDraft sends audit_assigned (not audit_submitted) notification to consultant

## Round 14 — Final UI Polish (Demo Ready)

- [x] Generate professional AuditFlow QAH app logo (NHS-inspired, clean, modern)
- [x] Upload logo to webdev static assets (CDN URL used directly in code; VITE_APP_LOGO is platform-managed)
- [x] Login page: replace generic icon with logo, add two-column layout with NHS branding panel
- [x] Sidebar: replace ClipboardList icon with logo image in AppLayout header
- [x] Dashboard: polished welcome banner with logo + name, improved StatCard with rounded-xl icons and hover shadow
- [x] Global: refined border-radius token (0.625rem), added shadow-card CSS variable, improved card hover shadows
- [x] Favicon: updated in index.html with CDN logo URL (webp + apple-touch-icon)

## Round 15 — Consultant Pending Login + Admin Notification

- [x] Backend: allow users with status=pending to log in (remove the pending-blocks-login guard)
- [x] Backend: auth.me / currentUser returns approvalStatus so frontend can detect pending state (currentUser already returns full user object)
- [x] Backend: on consultant registration, send in-app notification to admin (type: consultant_registered)
- [x] Backend: on consultant registration, send push notification to admin via notifyOwner (Manus notification service)
- [x] Frontend: App.tsx — if logged-in user is pending consultant, show PendingApproval page instead of dashboard
- [x] Frontend: PendingApproval page — shows logo, name, "Your account is awaiting admin approval" message, sign-out button
- [x] Frontend: Register.tsx — existing success card already shows Back to Login button; user can log in immediately after registration
- [x] Vitest: pending user can log in successfully (credential check passes, no FORBIDDEN guard)
- [x] Vitest: consultant registration triggers admin notification

## Round 16 — Consultant Approval Notification + Auto-redirect

- [x] Backend: after approveUser succeeds, send in-app notification to the approved consultant (type: account_approved)
- [x] Backend: after approveUser succeeds, send Manus push notification to the project owner (notifyOwner) as audit trail confirmation
- [x] Backend: add account_approved to the notifications type enum in schema; run db:push
- [x] Frontend: PendingApproval page — polls currentUser every 10s; when approved=true hard-redirects to / with a success toast
- [x] Frontend: Notifications page — ShieldCheck icon, emerald colour, "Account Approved" label for account_approved notifications
- [x] Vitest: approveUser triggers an in-app notification to the approved user (3 tests, 98 total)

## Round 17 — Consultant Name List Fix

- [x] Schema: create consultantNames table (id, title, fullName, grade, active, createdAt) separate from users
- [x] Seed: insert the 14 ENT consultant names into consultantNames table via SQL
- [x] Backend: expose audits.consultants procedure returning all active consultantNames rows
- [x] Backend: add audits.addConsultantName procedure (admin only) for manual additions
- [x] Frontend: UserApprovals dialog — populate dropdown from consultantNames table (always has 14 entries)
- [x] Frontend: UserApprovals dialog — add "Name not on list? Enter manually" toggle with name + grade inputs
- [x] Frontend: UserApprovals dialog — Confirm and Approve button always enabled (linking is optional)
- [x] Frontend: UserApprovals dialog — manual entry adds name to consultantNames table and links it

## Round 18 — Role-Specific Dashboards

### Clinician Dashboard (existing users who submit audits)
- [x] Keep current layout: quick stats (submitted/pending/approved/rejected), recent submissions, drafts, notifications
- [x] Remove any admin/consultant-only widgets from clinician view
- [x] CTA: "Submit New Audit" prominently visible

### Consultant Dashboard (replaces current generic dashboard for consultants)
- [x] Remove "Submit Audit" CTA — consultants do not submit
- [x] Top section: three action cards — Awaiting My Review (count + list), Approved by Me (count), Rejected by Me (count)
- [x] Approaching deadlines section: audits assigned to this consultant where auditEndDate is within 30 days and status=pending
- [x] Recent activity: last 5 decisions made (approved/rejected with audit title and date)
- [x] Quick link to Approval Queue

### Admin Dashboard (replaces current generic dashboard for admin)
- [x] Remove "Submit Audit" CTA — admin does not submit
- [x] Top stats row: Total Registered Audits, Pending Review, Approved, Rejected, Drafts
- [x] Audits per consultant table: for each consultant, show count of pending/approved/rejected audits assigned to them
- [x] Approaching deadlines section: all audits (any consultant) where auditEndDate ≤ 30 days and status=pending, sorted by deadline
- [x] Recent registrations: last 5 submitted audits across all users
- [x] Pending user approvals badge/card: count of pending consultant registrations with link to User Approvals

### Backend
- [x] tRPC procedure: admin.overviewStats — total counts by status across all audits
- [x] tRPC procedure: admin.auditsPerConsultant — for each consultantName, count pending/approved/rejected
- [x] tRPC procedure: admin.approachingDeadlines — audits where auditEndDate ≤ now+30d and status=pending/approved
- [x] tRPC procedure: admin.recentRegistrations — last 10 submitted audits (status != draft)
- [x] tRPC procedure: admin.auditsPerConsultant covers consultant queue stats; myConsultantQueue used for consultant dashboard
- [x] Vitest: 14 tests in round18.test.ts covering all four admin helpers (112 total)

## Round 19 — Consultant Queue Scoping, Live Badge, Clean Consultant List

- [x] Backend: ApprovalQueue procedure — when caller is a consultant, filter audits to only those where supervisorId matches their linkedConsultantId (uses linkedConsultantId ?? -1)
- [x] Backend: decide procedure — supervisor check now uses linkedConsultantId ?? -1 instead of user.id
- [x] Backend: admin myQueue — now filters !a.archived so archived-but-pending audits don't inflate the badge count
- [x] Frontend: ApprovalQueue page — hide approve/reject buttons for audits not assigned to the logged-in consultant (belt-and-suspenders)
- [x] Frontend: Sidebar badge — archiveMutation in AuditRegistry now invalidates myQueue and myConsultantQueue so badge updates live without page refresh
- [x] DB: Remove extra test consultant names from consultantNames table, keep only the 14 original ENT names
- [x] Vitest: updated mock data in notifications.test.ts and audit.trail.test.ts to include linkedConsultantId: 2 — all 112 tests passing

## Round 20 — Email Notifications & Collaborator Name+Email Capture

### Collaborator field update
- [x] Frontend: Change collaborators field in SubmitAudit Step 1 from plain string chips to name+email pair entries ({name, email})
- [x] Frontend: Update WizardData type — collaborators: {name: string; email: string}[]
- [x] Frontend: Update collaborator UI — two inputs per row (Name + Email) with add/remove
- [x] Frontend: Update ReviewRow display and PDF export to show "Name <email>" per collaborator
- [x] Frontend: Update draft hydration to handle new collaborator shape (backward-compatible with old string drafts)
- [x] Frontend: Update submit/save payloads — collaborators serialised as JSON array of {name, email}

### Email notification infrastructure
- [x] Backend: Install nodemailer + @types/nodemailer
- [x] Backend: Create server/_core/email.ts — sendEmail(to, subject, html) helper using SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- [x] Backend: Add SMTP env vars to ENV object in server/_core/env.ts
- [x] Backend: Create buildAuditStatusEmail — returns {subject, html} for each event type (approved, rejected, reassigned, archived, unarchived)
- [x] Backend: Create sendAuditStatusEmails — collects recipient list (submitter + collaborators + acting consultant) and calls sendEmail for each

### Wire emails into procedures
- [x] Backend: decide procedure — calls sendAuditStatusEmails after status update (approved/rejected)
- [x] Backend: reassign procedure — calls sendAuditStatusEmails after reassignment
- [x] Backend: archive procedure — calls sendAuditStatusEmails after archive/restore

### Secrets
- [x] Request SMTP credentials from user (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) — deferred, user does not have credentials yet; emails will be skipped gracefully until configured

### Tests
- [x] Vitest: 23 new email helper unit tests in server/email.test.ts
- [x] All 135 tests passing (up from 112)

## Round 21 — Email Verification on Registration

- [x] Schema: add emailVerified (boolean, default false) and emailVerifyToken (varchar 128, nullable) to users table
- [x] DB migration: pnpm db:push (migration 0013_fast_genesis.sql applied)
- [x] Backend: add sendVerificationEmail(user, origin) helper in server/_core/email.ts
- [x] Backend: update register procedure — set emailVerifyToken, send verification email, return { success, pendingVerification: true }
- [x] Backend: add verifyEmail publicProcedure — validates token, sets emailVerified=true, clears token
- [x] Backend: add resendVerification publicProcedure — generates new token, sends new email
- [x] Backend: update login procedure — block login with EMAIL_NOT_VERIFIED error if emailVerified=false (skip check for admin)
- [x] Frontend: update Register success screen to show "Check your email" message with email address shown
- [x] Frontend: add /verify-email?token=xxx page — calls verifyEmail procedure, shows success/error, redirects to login after 3s
- [x] Frontend: update login error handling — show "Email not verified" amber banner with Resend button
- [x] Frontend: register /verify-email route in App.tsx (excluded from auth redirect guard)
- [x] Tests: all 135 tests passing (no regressions)
- [x] Cleanup: delete all non-admin accounts after implementation

## Round 22 — Fix Email Delivery (Resend API + on-screen fallback)

- [x] Install resend npm package (resend 6.12.3)
- [x] Rewrite server/_core/email.ts to use Resend API (RESEND_API_KEY env var) as primary, SMTP as secondary fallback
- [x] Add on-screen fallback: when neither Resend nor SMTP is configured, return verifyUrl in register response so the link can be shown directly in the UI
- [x] Update register procedure to return { verifyUrl } when email delivery fails/unconfigured
- [x] Update Register success screen to show a clickable verification link when verifyUrl is returned
- [x] Run full test suite — all 135 tests pass
- [x] Delete all non-admin accounts
- [x] Request RESEND_API_KEY from user

## Round 23 — Missing Email Notifications

- [x] Backend: add sendRegistrationConfirmationEmail helper — sends a welcome/confirmation email to the newly registered user (all roles: clinician, consultant, admin)
- [x] Backend: wire sendRegistrationConfirmationEmail into register procedure after verification email
- [x] Backend: add sendAuditSubmissionEmails helper — sends "Your audit has been submitted and is awaiting consultant review" to submitter + collaborators
- [x] Backend: wire sendAuditSubmissionEmails into submit procedure (non-draft path only)
- [x] Backend: verified sendAuditStatusEmails correctly fans out to collaborators on decide (logic confirmed in code review — submitter + collaborators + actor)
- [x] Tests: all 135 tests passing (no regressions)

## Tranche A — Critical Security Fixes

- [x] Backend: remove `token` from requestPasswordReset return value — response is `{ success: true }` in both branches
- [x] Backend: hash token with SHA-256 before storing in passwordResetTokens table
- [x] Backend: hash incoming token with SHA-256 before lookup in resetPassword procedure
- [x] Backend: add sendPasswordResetEmail({ to, recipientName, token, origin }) to server/_core/email.ts
- [x] Backend: call sendPasswordResetEmail from inside requestPasswordReset when user is found
- [x] Frontend: ForgotPassword.tsx rewritten — no longer shows on-screen token; shows "check your email" message
- [x] Tests: updated "email exists" test — asserts result.token is undefined
- [x] Tests: added hash round-trip test — stores hashed token, calls resetPassword with raw token, verifies success
- [x] Verify: grep for `return { success: true, token }` — zero matches confirmed
- [x] All 135 tests passing

## Tranche A — Prompt 2: Remove Seed-Consultants Backdoor

- [x] Rewrite seed-consultants.mjs — seeds consultantNames table only (no users rows, no passwords, no bcrypt)
- [x] Uses INSERT IGNORE keyed on fullName so the script is safe to re-run
- [x] Removed all references to shared default password and bcrypt import from seed-consultants.mjs
- [x] Updated top comment to explain real consultant registration flow
- [x] Wrote cleanup-seeded-users.mjs — deletes users rows with openId like consultant-SLUG
- [x] Added db:seed npm script in package.json
- [x] Ran cleanup-seeded-users.mjs on live DB — no backdoor accounts found (already clean)
- [x] Ran pnpm db:seed — all 14 consultants inserted into consultantNames successfully
- [x] Verified: git grep for shared default password returns zero matches in source files (only in todo.md text)

## Tranche A — Prompt 3: Fix supervisorId/linkedConsultantId/users.id Confusion

- [x] Add getConsultantNameById(id) helper to server/db.ts
- [x] Fix (a) audits.submit: replaced getUserById(input.supervisorId) with getConsultantNameById; supervisorName derived as `${title} ${fullName}`
- [x] Fix (a) audits.updateDraft: same replacement for supervisorId resolution
- [x] Fix (b) audits.reassign: replaced getUserById(input.supervisorId) with getConsultantNameById; removed auditRole check
- [x] Fix (c) audits.reassign notification: looks up user via getUserByLinkedConsultantId(input.supervisorId); skips notification if no linked user
- [x] Fix (d) audits.comments: replaced audit.supervisorId === actor.id with actor.linkedConsultantId !== null && audit.supervisorId === actor.linkedConsultantId
- [x] Fix (e) audits.addComment: same replacement as (d)
- [x] Fix (f) audits.myConsultantQueue: replaced user.id lookup with user.linkedConsultantId lookup
- [x] Added invariant comment block at top of auditRouter in routers.ts
- [x] Wrote server/supervisor-scoping.test.ts with 7 pinned invariant tests across 4 describe blocks
- [x] All 142 tests passing
- [x] Verified: git grep -n "getUserById.*supervisorId" server/ returns zero matches (only in comment)

## Tranche A — Prompt 4: Auth Storage Proxy

- [x] Installed supertest 7.2.2 and @types/supertest 7.2.0 as dev dependencies
- [x] Rewrote server/_core/storageProxy.ts: parses nhs_audit_session cookie, verifies JWT with jose, resolves user via getUserByOpenId — returns 401 if missing/invalid
- [x] Per-resource authz: audit-pdf/{auditId}/... — allows submitter, assigned supervisor (linkedConsultantId match), or admin; anything else — admin only
- [x] Returns 403 Forbidden if authz fails; only proceeds to Forge presign after both checks pass
- [x] Added key-prefix convention comment block in storageProxy.ts
- [x] Wrote server/storage-proxy.test.ts with 4 tests: 401 no cookie, 401 invalid cookie, 403 wrong clinician, 307 assigned consultant
- [x] All 146 tests passing (4 new storage proxy tests)
- [x] Verified: curl /manus-storage/any-key returns HTTP/2 401 without cookie (confirmed on live dev server)

## Tranche A — Prompt 5: Lock Down Full-Registry Endpoints

- [x] Backend: audits.list — add admin-only guard (auditRole !== "admin" → FORBIDDEN)
- [x] Backend: audits.listWithHistory — add admin-only guard
- [x] Backend: audits.history — add ACL: allow admin, submitter (actor.id === audit.submittedById), or assigned supervisor (actor.linkedConsultantId === audit.supervisorId); otherwise FORBIDDEN
- [x] Backend: add audits.myAuditsRegistry — returns audits where user is submitter, collaborator (JSON array), or assigned supervisor; admins fall through to all audits
- [x] Frontend: AuditRegistry.tsx — use trpc.audits.myAuditsRegistry for non-admins, trpc.audits.list for admins; invalidate correct query after archive/reassign
- [x] Frontend: ExportData.tsx — gate behind admin; show "Not authorised" notice for non-admins
- [x] Tests: audits.history forbidden for random clinician, allowed for submitter/assigned consultant/admin
- [x] Tests: audits.myAuditsRegistry returns only involved audits
- [x] Tests: audits.list and audits.listWithHistory throw FORBIDDEN for clinician
- [x] Run pnpm test and pnpm check — all pass (159 tests, 0 TypeScript errors)

## Tranche A — Prompt 6: Escape HTML in Email Templates

- [x] Add escapeHtml(s) helper to server/_core/email.ts — escapes & < > " '
- [x] Add safeSubject(s) helper — strips CR/LF to prevent email header injection
- [x] baseTemplate: escape title parameter in <h2> (contains refNumber from subject)
- [x] buildAuditStatusEmail: wrap refNumber, topic, actorName, recipientName, note, newSupervisorName with escapeHtml()
- [x] sendVerificationEmail: wrap recipientName, verifyUrl (display text) with escapeHtml()
- [x] sendRegistrationConfirmationEmail: wrap recipientName, grade, to (email address) with escapeHtml()
- [x] sendAuditSubmissionEmails: wrap refNumber, topic, submitterName, supervisorName, recipientName with escapeHtml(); wrap subject with safeSubject()
- [x] sendPasswordResetEmail: wrap recipientName, resetUrl (display text) with escapeHtml()
- [x] Write server/email-escape.test.ts — 15 tests covering escapeHtml, safeSubject, and buildAuditStatusEmail with malicious inputs
- [x] Run pnpm test and pnpm check — all pass (174 tests, 0 TypeScript errors)
- [x] Verified: git grep shows all HTML interpolations use e-prefixed escaped variables

## Tranche A — Prompt 7: CSRF Protection and Tighter Cookie Defaults

- [x] server/_core/cookies.ts: change sameSite from "none" to "lax"
- [x] server/_core/cookies.ts: force secure=true when NODE_ENV === "production" (never ship cookie in cleartext in prod)
- [x] client/src/main.tsx: add headers() callback to httpBatchLink sending x-auditflow-client: 1 on every tRPC request
- [x] server/_core/index.ts: export csrfProtection middleware; apply it before the tRPC handler on /api/trpc
- [x] csrfProtection: rejects POST/PUT/PATCH/DELETE without x-auditflow-client: 1 header with 403; allows GET/HEAD/OPTIONS
- [x] server/auth.logout.test.ts: update sameSite assertion from "none" to "lax"
- [x] server/csrf.test.ts: 10 tests covering all HTTP methods, correct/incorrect/missing header values
- [x] Run pnpm test and pnpm check — all pass (184 tests, 0 TypeScript errors)

## Tranche A — Prompt 8: Rate-limit Public Auth Endpoints

- [x] Install express-rate-limit dependency
- [x] server/_core/index.ts: add per-IP rate limiters for auth.login (10/min), auth.register (5/hr), auth.requestPasswordReset (5/hr), auth.resendVerification (5/hr) — mounted before tRPC handler
- [x] Rate limiters respond 429 with JSON { error: { code: "TOO_MANY_REQUESTS", message: "..." } }
- [x] client/src/pages/Login.tsx: display 429 error message as toast
- [x] client/src/pages/Register.tsx: display 429 error message as toast
- [x] server/rate-limit.test.ts: hammer login 11 times from same IP, assert 11th returns 429
- [x] Run pnpm test and pnpm check — all pass (191 tests, 0 TypeScript errors)

## Tranche A — Prompt 9: Atomic Reference-Number Generation

- [x] drizzle/schema.ts: add refCounters table (date varchar(8) PK, counter int not null default 0)
- [x] Run pnpm db:push to create the migration and apply it (migration: 0014_early_black_cat.sql)
- [x] server/db.ts: add getNextRefCounter(date) helper using INSERT...ON DUPLICATE KEY UPDATE
- [x] server/routers.ts: replace racy countAudits()+1 pattern with getNextRefCounter() in audits.submit
- [x] server/ref-counter.test.ts: 10 concurrent submit calls, assert all refNumbers unique
- [x] Run pnpm test and pnpm check — all pass (197 tests, 0 TypeScript errors)
