# AuditFlow QAH — System Overview

**Portsmouth Hospitals University NHS Trust — ENT Department**
Queen Alexandra Hospital, Clinical Audit Management System

---

## Executive Summary

AuditFlow QAH is a purpose-built, web-based clinical audit management system developed for the Ear, Nose and Throat (ENT) Department at Portsmouth Hospitals University NHS Trust (PHU). The system digitises and streamlines the full clinical audit lifecycle — from initial registration through to consultant approval, outcome tracking, and governance reporting — replacing paper-based and ad-hoc processes with a structured, auditable, and role-governed digital workflow.

The platform is accessible from any modern web browser without the need for local software installation, and is hosted on a secure cloud infrastructure with NHS-grade data handling. It supports three distinct user roles — clinicians, supervising consultants, and department administrators — each with a tailored interface and precisely scoped permissions.

---

## 1. Background and Rationale

Clinical audit is a core component of NHS quality improvement, required by the Care Quality Commission (CQC) and mandated under NHS England's clinical governance framework. ENT departments are expected to maintain a register of ongoing and completed audits, ensure consultant oversight of audit registrations, and report outcomes to governance committees.

Prior to AuditFlow QAH, audit registrations at PHU ENT were managed through a combination of paper forms, email chains, and shared spreadsheets. This approach created several challenges: lack of a single source of truth, no structured approval workflow, difficulty tracking audit status across the department, and no automated notifications to keep stakeholders informed. AuditFlow QAH was designed to address each of these pain points directly.

---

## 2. User Roles and Access Control

The system enforces a three-tier role model. Every user is assigned one of three roles at registration, and the system's backend procedures validate role permissions on every request — there is no client-side-only access control.

| Role | Who | Key Permissions |
|---|---|---|
| **Clinician** | Registrars, SHOs, Foundation doctors, Specialist nurses, Audiologists, AHPs, Medical students | Submit and manage own audits; view own audit status; add collaborators; comment on own audits |
| **Consultant** | Named ENT consultants linked to the department roster | Review and approve or reject audits assigned to them; view their Approval Queue; access Decision Log |
| **Administrator** | Department audit lead / governance coordinator | Full access to all audits; user management; consultant approval; reassignment; archive/restore; statistics; data export |

Consultant accounts undergo a two-step verification process: email verification on registration, followed by explicit approval by the administrator before the consultant can access their Approval Queue. This ensures that only verified, named consultants within the department can make approval decisions.

---

## 3. Core Features

### 3.1 Structured Audit Registration

Clinicians submit audits through a guided multi-step wizard. The form captures all fields required by NHS clinical audit governance standards, organised into two stages.

**Step 1 — Basic Registration** collects the audit topic, clinical category (drawn from the ten ENT sub-specialties listed below), clinical setting, priority classification, whether the submission is a re-audit of a previous cycle, a description of the audit, the assigned supervising consultant, and any collaborators (with their names and email addresses).

| ENT Category | Code |
|---|---|
| Otology | OTO |
| Rhinology | RHI |
| Head & Neck | HAN |
| Laryngology | LAR |
| Paediatric ENT | PED |
| Thyroid & Endocrine | THY |
| Audiology | AUD |
| General ENT | GEN |
| MDT / Governance | MDT |
| Other | OTH |

**Step 2 — Clinical Detail** captures the full audit registration form as required by the department's governance process: audit objectives, reason for audit (NICE guideline, national audit, CQC regulation, local priority, or other), audit standards with measurable criteria and target compliance percentages, evidence base, planned start and end dates, data collection method (retrospective or prospective), sampling methodology, data analysis plan, results presentation targets, action plan ownership, potential barriers to change, and re-audit timeline.

The system includes built-in **NICE and Royal College standard presets** for each ENT sub-specialty, drawn from NICE guidelines, RCSENG standards, BAO-HNS guidance, and BACO guidance. These presets auto-populate the standards table, reducing data entry burden and ensuring compliance with recognised evidence bases.

Audits can be saved as **drafts** at any point and returned to later, allowing clinicians to build their submission incrementally without losing progress.

### 3.2 Consultant Approval Workflow

Once an audit is submitted, it enters a **Pending** state and appears in the Approval Queue of the assigned supervising consultant. The consultant reviews the full audit registration, including all clinical detail fields, and makes one of two decisions:

- **Approve** — the audit is marked as approved and moves to the registry. The submitter, all listed collaborators, and the consultant each receive an automated email notification.
- **Reject** — the audit is returned to the submitter with an optional decision note explaining the reason. Email notifications are sent to all parties.

Consultants can only see and act on audits explicitly assigned to them. They cannot view or action audits assigned to other consultants, ensuring appropriate governance boundaries.

### 3.3 Audit Registry

The Audit Registry provides the administrator with a complete, searchable, and filterable view of all audits across the department. Audits can be filtered by status (draft, pending, approved, rejected), category, priority, and date range. The registry supports:

- **Inline reassignment** — the administrator can reassign a pending audit to a different supervising consultant without requiring the submitter to resubmit.
- **Archive and restore** — approved or rejected audits can be archived to keep the active registry clean, and restored at any time. Archived audits are excluded from the pending approval badge count.
- **Re-audit linking** — when a clinician submits a re-audit, it is automatically linked to the original audit record, creating a traceable cycle of improvement.

### 3.4 Audit Trail

Every action taken on an audit — submission, approval, rejection, reassignment, archiving, restoring, and comments — is recorded in a tamper-evident **audit trail**. Each event captures the actor's name, the event type, a timestamp, and any associated detail (such as a decision note or new supervisor name). The audit trail is visible to the administrator and to the submitter of the audit, providing full transparency and supporting CQC inspection requirements.

### 3.5 Comment Thread

Each audit has a **threaded comment system** allowing the submitter, the assigned consultant, and the administrator to communicate directly within the context of the audit record. Comments are timestamped, attributed to the author by name and role, and visible to all parties with access to that audit. This replaces email chains and ensures all communication is captured in one place.

### 3.6 Status Lookup (Public Reference Check)

Clinicians can look up the current status of any audit using its reference number (format: `REF-YYYYMMDD-NNNN`) without needing to navigate the full registry. This is particularly useful for clinicians who have submitted audits and want a quick status check without logging in.

### 3.7 Audit Calendar

A monthly calendar view displays all audit submissions and deadlines, colour-coded by status. The administrator and consultants can navigate month by month to see the distribution of audit activity across the department and identify periods of high workload.

### 3.8 Statistics Dashboard

The Statistics module provides real-time visualisations of audit activity across the department, including:

- Total audit counts by status (approved, pending, rejected, draft)
- Breakdown by ENT category (bar chart)
- Breakdown by submitter clinical grade
- Monthly submission trend (last 6 months, bar chart)
- Status distribution (pie chart)

These visualisations are generated dynamically from live data and require no manual reporting effort.

### 3.9 Data Export

The administrator can export the full audit registry — or a filtered subset by year and status — as a **CSV file** suitable for import into Excel, NHS reporting tools, or the Trust's clinical governance database. The export includes all key fields: reference number, status, submitter details, category, setting, priority, topic, data collection period, sample size, description, submission date, decision date, and decision note.

### 3.10 Consultant Decision Log

A dedicated view provides a complete, searchable record of all approval and rejection decisions made by consultants, including the decision date, decision note, and the consultant who made the decision. This supports departmental governance reviews and provides an audit-ready record of consultant oversight activity.

### 3.11 User Management and Approvals

The administrator has a full **User Management** panel showing all registered accounts with their name, email, grade, role, approval status, and email verification status. From this panel, the administrator can:

- Approve or reject pending consultant registrations
- Link a consultant account to the named consultant roster (which determines which audits appear in that consultant's Approval Queue)
- View and manage all user accounts

A separate **User Approvals** queue surfaces only the accounts awaiting action, reducing the cognitive load of the full user list.

### 3.12 Consultant Roster Management

The system maintains an independent **consultant names roster** — a canonical list of ENT consultants at PHU, seeded with the department's named consultants. This roster is separate from user accounts, allowing clinicians to assign audits to a named consultant even before that consultant has registered an account. When a consultant registers and is approved, the administrator links their account to the roster entry, activating their Approval Queue.

---

## 4. Email Notification System

AuditFlow QAH sends automated HTML email notifications at every significant point in the audit lifecycle, ensuring all parties are kept informed without manual follow-up. Emails are delivered via the **Resend** transactional email service.

| Trigger | Recipients |
|---|---|
| Account registered | Registering user — welcome/confirmation with grade and next steps |
| Email verification | Registering user — verification link (24-hour expiry) |
| Audit submitted | Submitter + all listed collaborators — confirmation with reference number, topic, and assigned consultant |
| Audit approved | Submitter + all collaborators + approving consultant |
| Audit rejected | Submitter + all collaborators + rejecting consultant (with decision note) |
| Audit reassigned | Submitter + all collaborators + administrator |
| Audit archived / restored | Submitter + all collaborators + administrator |

Duplicate emails are suppressed (for example, if the acting consultant is also the submitter, only one email is sent). All email sending is non-blocking and best-effort — a failure to deliver an email does not interrupt the audit workflow.

---

## 5. Security and Access Control

### 5.1 Authentication

All users authenticate using a registered email address and password. Passwords are hashed using **bcrypt** with a cost factor of 12 before storage — plain-text passwords are never stored. Sessions are managed via a signed **JWT cookie** (using the `jose` library), which is validated on every API request.

### 5.2 Email Verification

Every new account must verify their email address before logging in. A unique, time-limited token (valid for 24 hours) is sent to the registered email. This prevents registration with invalid or mistyped email addresses and ensures that email notifications reach the correct recipient.

### 5.3 Role-Based Access Control

Backend procedures enforce role checks on every request using the `protectedProcedure` and role-specific guards. There is no reliance on frontend-only access control. Key examples include:

- Consultants can only approve or reject audits where their `linkedConsultantId` matches the audit's `supervisorId` — they cannot action audits assigned to other consultants.
- Only administrators can access User Management, User Approvals, the full Audit Registry, reassignment, archiving, and data export.
- Clinicians can only view and manage their own audits.

### 5.4 Password Reset

A secure, token-based **password reset** flow is implemented. The user requests a reset via their registered email; a single-use, time-limited token is sent; and the token is invalidated immediately after use. Tokens are stored as hashed values and cannot be reused.

### 5.5 Data Storage

All data is stored in a **MySQL/TiDB** relational database hosted on the Manus cloud platform. The database schema is managed using **Drizzle ORM** with versioned migrations, ensuring schema changes are tracked and reversible. File assets (such as exported PDFs) are stored in **S3-compatible object storage** and served via signed URLs.

---

## 6. Technical Architecture

AuditFlow QAH is a full-stack TypeScript web application built on a modern, production-ready stack.

| Layer | Technology |
|---|---|
| **Frontend framework** | React 19 with TypeScript |
| **Styling** | Tailwind CSS 4 with shadcn/ui component library |
| **API layer** | tRPC 11 (end-to-end type-safe RPC over HTTP) |
| **Backend runtime** | Node.js with Express 4 |
| **Database ORM** | Drizzle ORM with versioned migrations |
| **Database** | MySQL / TiDB (cloud-hosted) |
| **Authentication** | Custom password-auth with bcrypt + JWT session cookies |
| **Email delivery** | Resend transactional email API |
| **File storage** | S3-compatible object storage |
| **Build tooling** | Vite (frontend), esbuild (server bundle) |
| **Testing** | Vitest (135 unit and integration tests) |
| **Hosting** | Manus cloud platform (auto-scaling, HTTPS) |

The frontend and backend share a single TypeScript codebase, with types flowing end-to-end from the database schema through the tRPC procedures to the React components. This eliminates an entire class of runtime type errors and makes the codebase significantly easier to maintain and extend.

---

## 7. Audit Reference Numbering

Every submitted audit is assigned a unique, human-readable reference number in the format:

```
REF-YYYYMMDD-NNNN
```

For example, `REF-20260514-0001` identifies the first audit submitted on 14 May 2026. The sequential number is department-wide and never reused, providing a permanent, unambiguous identifier for every audit record. This reference number is used in all email notifications, the audit trail, the comment thread, and the status lookup tool.

---

## 8. Workflow Summary

The following diagram describes the end-to-end lifecycle of a clinical audit from registration to completion.

```
Clinician registers account
        │
        ▼
Email verification (24-hour link)
        │
        ▼
Clinician logs in and completes audit submission wizard (Steps 1 & 2)
        │
        ├─ Save as draft (can return and edit)
        │
        └─ Submit (status: Pending)
                │
                ├─ Email to submitter + collaborators: "Audit submitted"
                │
                ▼
        Appears in consultant's Approval Queue
                │
                ├─ Consultant approves → status: Approved
                │       └─ Email to submitter + collaborators + consultant
                │
                └─ Consultant rejects → status: Rejected (with note)
                        └─ Email to submitter + collaborators + consultant
                                │
                                ▼
                        Admin reviews in Audit Registry
                                │
                                ├─ Reassign to different consultant
                                ├─ Archive (removes from active queue)
                                └─ Export to CSV for governance reporting
```

---

## 9. Clinical Governance Alignment

AuditFlow QAH is designed to support the department's obligations under the following frameworks:

- **CQC Regulation 17** (Good Governance) — the system provides a complete, timestamped audit trail of all actions, supporting evidence of systematic quality improvement activity.
- **NHS England Clinical Audit Policy** — the structured registration form captures all fields required by the national clinical audit registration standard, including objectives, standards, evidence base, and re-audit planning.
- **NICE Quality Standards** — built-in standard presets for each ENT sub-specialty are drawn directly from NICE guidelines, RCSENG standards, BAO-HNS guidance, and BACO guidance, reducing the risk of non-evidence-based audit standards being registered.
- **Information Governance** — all data is stored within the Manus cloud platform's secure infrastructure. No patient-identifiable data is collected or stored in the system; audit registrations capture departmental process and outcome data only.

---

## 10. Current Status and Deployment

AuditFlow QAH is live and accessible at:

**[https://auditqah-436kjx9h.manus.space](https://auditqah-436kjx9h.manus.space)**

The system is in active use and has completed 23 rounds of iterative development, incorporating feedback from the department audit lead at each stage. The test suite comprises **135 automated tests** covering authentication, audit submission, consultant approval, email notifications, audit trail recording, and data integrity.

---

## 11. Planned Enhancements

The following enhancements have been identified for future development cycles:

- **Custom sender domain** — verification of an NHS-branded sender domain (e.g. `auditflow.porthosp.nhs.uk`) so that email notifications arrive from a recognisable Trust address rather than the current default sender.
- **Consultant approval email** — an automated email to consultants when the administrator approves their account, confirming they now have access to the Approval Queue.
- **Bulk CSV export with collaborator data** — extend the export to include collaborator names and emails for governance reporting.
- **Dashboard deadline alerts** — a dismissible banner surfacing audits with deadlines within 7 days, to complement the existing approaching-deadlines list.
- **Audit outcome recording** — a post-approval step allowing consultants to record final audit outcomes, findings, and confirmed re-audit dates, visible in the audit trail and exportable in the PDF summary.

---

*Document prepared by the AuditFlow QAH development team. For technical queries, contact the department IT lead.*
