// AuditFlow QAH — Local data store using localStorage for demo purposes
// Provides CRUD operations that mirror the base44 API shape

import { nanoid } from "nanoid";
import { generateRef, generateSerial, getCategoryCode } from "./auditConstants";

export interface AuditSubmission {
  id: string;
  ref: string;
  serial?: string;
  status: "draft" | "pending" | "approved" | "rejected";
  auditor: string;
  grade: string;
  email: string;
  type: string;       // category label
  setting: string;
  priority: string;
  topic?: string;
  period?: string;
  sample?: string;
  reaudit?: string;
  description: string;
  collaborators?: string[];
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  archived?: boolean;
  created_date: string;
}

export interface AuditHistoryLog {
  id: string;
  submission_id: string;
  submission_ref: string;
  event: "submitted" | "approved" | "rejected" | "archived" | "restored" | "deleted";
  actor: string;
  actor_email?: string;
  note?: string;
  created_date: string;
}

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: "clinician" | "consultant" | "admin";
  approved: boolean;
  created_date: string;
}

export interface AppSettings {
  dept: string;
  hosp: string;
  trust: string;
  prefix: string;
}

// ── Keys ────────────────────────────────────────────────────────────────────
const SUBMISSIONS_KEY = "auditflow_submissions";
const LOGS_KEY = "auditflow_logs";
const USERS_KEY = "auditflow_users";
const SETTINGS_KEY = "auditflow_settings";
const COUNTER_KEY = "auditflow_counter";
const CURRENT_USER_KEY = "auditflow_current_user";

// ── Helpers ──────────────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_USERS: AppUser[] = [
  {
    id: "u1",
    full_name: "Dr. Sarah Mitchell",
    email: "s.mitchell@porthosp.nhs.uk",
    role: "admin",
    approved: true,
    created_date: "2025-01-10T09:00:00Z",
  },
  {
    id: "u2",
    full_name: "Mr. James Hargreaves",
    email: "j.hargreaves@porthosp.nhs.uk",
    role: "consultant",
    approved: true,
    created_date: "2025-01-12T10:30:00Z",
  },
  {
    id: "u3",
    full_name: "Dr. Priya Nair",
    email: "p.nair@porthosp.nhs.uk",
    role: "clinician",
    approved: true,
    created_date: "2025-02-01T08:00:00Z",
  },
  {
    id: "u4",
    full_name: "Dr. Tom Ellison",
    email: "t.ellison@porthosp.nhs.uk",
    role: "clinician",
    approved: false,
    created_date: "2025-05-01T11:00:00Z",
  },
];

const SEED_SETTINGS: AppSettings = {
  dept: "ENT Department",
  hosp: "Queen Alexandra Hospital",
  trust: "Portsmouth Hospitals University NHS Trust",
  prefix: "QAH",
};

const SEED_SUBMISSIONS: AuditSubmission[] = [
  {
    id: "s1",
    ref: "REF-20250310-0001",
    serial: "QAH-2025-OTO-0001",
    status: "approved",
    auditor: "Dr. Priya Nair",
    grade: "Registrar (SpR)",
    email: "p.nair@porthosp.nhs.uk",
    type: "Otology",
    setting: "Outpatient clinic",
    priority: "Standard",
    topic: "Hearing Aid Fitting Compliance",
    period: "Jan-Mar 2025",
    sample: "80 patients",
    reaudit: "No",
    description: "Assessing compliance rates for hearing aid fitting appointments in the audiology outpatient clinic against NICE guidelines.",
    approved_by: "Mr. James Hargreaves",
    approved_at: "2025-03-15T14:22:00Z",
    archived: false,
    created_date: "2025-03-10T09:15:00Z",
  },
  {
    id: "s2",
    ref: "REF-20250402-0002",
    serial: "QAH-2025-RHI-0001",
    status: "approved",
    auditor: "Dr. Priya Nair",
    grade: "Registrar (SpR)",
    email: "p.nair@porthosp.nhs.uk",
    type: "Rhinology",
    setting: "Theatre / surgical",
    priority: "High",
    topic: "Septoplasty Outcomes",
    period: "Feb-Apr 2025",
    sample: "45 patients",
    reaudit: "Yes - 1st re-audit",
    description: "Re-audit of post-operative outcomes following septoplasty procedures, measuring against the 2023 baseline.",
    approved_by: "Mr. James Hargreaves",
    approved_at: "2025-04-08T11:05:00Z",
    archived: false,
    created_date: "2025-04-02T10:00:00Z",
  },
  {
    id: "s3",
    ref: "REF-20250415-0003",
    status: "pending",
    auditor: "Dr. Priya Nair",
    grade: "Registrar (SpR)",
    email: "p.nair@porthosp.nhs.uk",
    type: "Head & Neck",
    setting: "MDT meeting",
    priority: "Urgent",
    topic: "MDT Documentation Standards",
    period: "Apr-Jun 2025",
    sample: "60 cases",
    reaudit: "No",
    description: "Audit of MDT meeting documentation standards against Royal College of Surgeons guidelines, focusing on completeness of records.",
    archived: false,
    created_date: "2025-04-15T14:30:00Z",
  },
  {
    id: "s4",
    ref: "REF-20250420-0004",
    status: "pending",
    auditor: "Dr. Tom Ellison",
    grade: "SHO / CT",
    email: "t.ellison@porthosp.nhs.uk",
    type: "General ENT",
    setting: "Outpatient clinic",
    priority: "Routine",
    topic: "Tonsillectomy Referral Criteria",
    period: "Mar-May 2025",
    sample: "100 patients",
    reaudit: "No",
    description: "Review of tonsillectomy referral criteria adherence in the general ENT outpatient clinic.",
    archived: false,
    created_date: "2025-04-20T09:45:00Z",
  },
  {
    id: "s5",
    ref: "REF-20250501-0005",
    status: "rejected",
    auditor: "Dr. Priya Nair",
    grade: "Registrar (SpR)",
    email: "p.nair@porthosp.nhs.uk",
    type: "Audiology",
    setting: "Outpatient clinic",
    priority: "Standard",
    topic: "Paediatric Hearing Screening",
    period: "May 2025",
    sample: "30 patients",
    reaudit: "No",
    description: "Audit of paediatric hearing screening referral pathways.",
    rejected_by: "Mr. James Hargreaves",
    rejected_at: "2025-05-05T10:00:00Z",
    rejection_reason: "Insufficient sample size proposed. Please revise to include at least 50 patients and resubmit.",
    archived: false,
    created_date: "2025-05-01T08:00:00Z",
  },
  {
    id: "s6",
    ref: "REF-20250505-0006",
    status: "draft",
    auditor: "Dr. Sarah Mitchell",
    grade: "Consultant",
    email: "s.mitchell@porthosp.nhs.uk",
    type: "Thyroid & Endocrine",
    setting: "Theatre / surgical",
    priority: "High",
    topic: "Thyroidectomy Complication Rates",
    period: "Jun-Aug 2025",
    sample: "55 patients",
    reaudit: "No",
    description: "Draft audit proposal for reviewing thyroidectomy complication rates against BAETS standards.",
    archived: false,
    created_date: "2025-05-05T16:00:00Z",
  },
];

const SEED_LOGS: AuditHistoryLog[] = [
  {
    id: "l1",
    submission_id: "s1",
    submission_ref: "REF-20250310-0001",
    event: "approved",
    actor: "Mr. James Hargreaves",
    actor_email: "j.hargreaves@porthosp.nhs.uk",
    note: "Well-structured proposal with clear methodology.",
    created_date: "2025-03-15T14:22:00Z",
  },
  {
    id: "l2",
    submission_id: "s2",
    submission_ref: "REF-20250402-0002",
    event: "approved",
    actor: "Mr. James Hargreaves",
    actor_email: "j.hargreaves@porthosp.nhs.uk",
    note: "Good re-audit design. Approved for data collection.",
    created_date: "2025-04-08T11:05:00Z",
  },
  {
    id: "l3",
    submission_id: "s5",
    submission_ref: "REF-20250501-0005",
    event: "rejected",
    actor: "Mr. James Hargreaves",
    actor_email: "j.hargreaves@porthosp.nhs.uk",
    note: "Insufficient sample size proposed. Please revise to include at least 50 patients and resubmit.",
    created_date: "2025-05-05T10:00:00Z",
  },
];

// ── Initialise store if empty ─────────────────────────────────────────────────
export function initStore(): void {
  if (!localStorage.getItem(USERS_KEY)) save(USERS_KEY, SEED_USERS);
  if (!localStorage.getItem(SETTINGS_KEY)) save(SETTINGS_KEY, SEED_SETTINGS);
  if (!localStorage.getItem(SUBMISSIONS_KEY)) save(SUBMISSIONS_KEY, SEED_SUBMISSIONS);
  if (!localStorage.getItem(LOGS_KEY)) save(LOGS_KEY, SEED_LOGS);
  if (!localStorage.getItem(COUNTER_KEY)) save(COUNTER_KEY, SEED_SUBMISSIONS.length);
  if (!localStorage.getItem(CURRENT_USER_KEY)) save(CURRENT_USER_KEY, SEED_USERS[0]);
}

// ── Current user ─────────────────────────────────────────────────────────────
export function getCurrentUser(): AppUser {
  return load<AppUser>(CURRENT_USER_KEY, SEED_USERS[0]);
}

export function setCurrentUser(user: AppUser): void {
  save(CURRENT_USER_KEY, user);
}

export function getAllUsers(): AppUser[] {
  return load<AppUser[]>(USERS_KEY, SEED_USERS);
}

// ── Submissions ───────────────────────────────────────────────────────────────
export function getSubmissions(): AuditSubmission[] {
  return load<AuditSubmission[]>(SUBMISSIONS_KEY, []);
}

export function getSubmissionByRef(ref: string): AuditSubmission | undefined {
  return getSubmissions().find((s) => s.ref === ref);
}

export function createSubmission(
  data: Omit<AuditSubmission, "id" | "ref" | "serial" | "created_date">,
  settings: AppSettings
): AuditSubmission {
  const counter = load<number>(COUNTER_KEY, 0);
  const ref = generateRef(counter);
  const categoryCode = getCategoryCode(data.type);
  const serial = generateSerial(settings.prefix, new Date().getFullYear(), categoryCode, counter + 1);
  const submission: AuditSubmission = {
    ...data,
    id: nanoid(),
    ref,
    serial,
    created_date: new Date().toISOString(),
  };
  const all = getSubmissions();
  save(SUBMISSIONS_KEY, [...all, submission]);
  save(COUNTER_KEY, counter + 1);
  return submission;
}

export function updateSubmission(id: string, data: Partial<AuditSubmission>): void {
  const all = getSubmissions().map((s) => (s.id === id ? { ...s, ...data } : s));
  save(SUBMISSIONS_KEY, all);
}

export function deleteSubmission(id: string): void {
  save(SUBMISSIONS_KEY, getSubmissions().filter((s) => s.id !== id));
}

// ── Logs ──────────────────────────────────────────────────────────────────────
export function getLogs(): AuditHistoryLog[] {
  return load<AuditHistoryLog[]>(LOGS_KEY, []);
}

export function createLog(data: Omit<AuditHistoryLog, "id" | "created_date">): AuditHistoryLog {
  const log: AuditHistoryLog = {
    ...data,
    id: nanoid(),
    created_date: new Date().toISOString(),
  };
  save(LOGS_KEY, [...getLogs(), log]);
  return log;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function getSettings(): AppSettings {
  return load<AppSettings>(SETTINGS_KEY, SEED_SETTINGS);
}

export function updateSettings(data: Partial<AppSettings>): void {
  save(SETTINGS_KEY, { ...getSettings(), ...data });
}

// ── Users ─────────────────────────────────────────────────────────────────────
export function updateUserRole(userId: string, role: AppUser["role"]): void {
  const users = getAllUsers().map((u) => (u.id === userId ? { ...u, role } : u));
  save(USERS_KEY, users);
}

export function approveUser(userId: string): void {
  const users = getAllUsers().map((u) => (u.id === userId ? { ...u, approved: true } : u));
  save(USERS_KEY, users);
}

export function rejectUser(userId: string): void {
  save(USERS_KEY, getAllUsers().filter((u) => u.id !== userId));
}

export function addUser(user: Omit<AppUser, "id" | "created_date">): AppUser {
  const newUser: AppUser = { ...user, id: nanoid(), created_date: new Date().toISOString() };
  save(USERS_KEY, [...getAllUsers(), newUser]);
  return newUser;
}
