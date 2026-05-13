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
