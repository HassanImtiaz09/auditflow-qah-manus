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
