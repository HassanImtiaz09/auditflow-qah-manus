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
  /** The grade/title selected at registration (from GRADES list) */
  grade?: string;
  /** Whether the admin has approved this account */
  approved: boolean;
  /** For consultants: whether the admin has confirmed their consultant role */
  role_approved?: boolean;
  created_date: string;
}

export interface AppNotification {
  id: string;
  type: "consultant_registration";
  message: string;
  user_id: string;
  read: boolean;
  created_date: string;
}

export interface AppSettings {
  dept: string;
  hosp: string;
  trust: string;
  prefix: string;
}

// ── Keys ────────────────────────────────────────────────────────────────────
// Bump this version whenever the data schema changes to force a clean re-seed
const STORE_VERSION = "v2-no-seed-audits";
const VERSION_KEY = "auditflow_version";

const SUBMISSIONS_KEY = "auditflow_submissions";
const LOGS_KEY = "auditflow_logs";
const USERS_KEY = "auditflow_users";
const SETTINGS_KEY = "auditflow_settings";
const COUNTER_KEY = "auditflow_counter";
const CURRENT_USER_KEY = "auditflow_current_user";
const NOTIFICATIONS_KEY = "auditflow_notifications";

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

// ── Seed data — users only, NO audit submissions ─────────────────────────────
const SEED_USERS: AppUser[] = [
  {
    id: "u1",
    full_name: "Dr. Sarah Mitchell",
    email: "s.mitchell@porthosp.nhs.uk",
    role: "admin",
    grade: "Consultant",
    approved: true,
    role_approved: true,
    created_date: "2025-01-10T09:00:00Z",
  },
];

const SEED_SETTINGS: AppSettings = {
  dept: "ENT Department",
  hosp: "Queen Alexandra Hospital",
  trust: "Portsmouth Hospitals University NHS Trust",
  prefix: "QAH",
};

// ── Initialise store if empty ─────────────────────────────────────────────────
export function initStore(): void {
  // If the store version doesn't match, wipe everything and re-seed
  const storedVersion = localStorage.getItem(VERSION_KEY);
  if (storedVersion !== STORE_VERSION) {
    // Clear all keys
    [
      SUBMISSIONS_KEY, LOGS_KEY, USERS_KEY, SETTINGS_KEY,
      COUNTER_KEY, CURRENT_USER_KEY, NOTIFICATIONS_KEY,
    ].forEach((k) => localStorage.removeItem(k));
    save(VERSION_KEY, STORE_VERSION);
  }

  if (!localStorage.getItem(USERS_KEY)) save(USERS_KEY, SEED_USERS);
  if (!localStorage.getItem(SETTINGS_KEY)) save(SETTINGS_KEY, SEED_SETTINGS);
  if (!localStorage.getItem(SUBMISSIONS_KEY)) save(SUBMISSIONS_KEY, []);
  if (!localStorage.getItem(LOGS_KEY)) save(LOGS_KEY, []);
  if (!localStorage.getItem(COUNTER_KEY)) save(COUNTER_KEY, 0);
  if (!localStorage.getItem(CURRENT_USER_KEY)) save(CURRENT_USER_KEY, SEED_USERS[0]);
  if (!localStorage.getItem(NOTIFICATIONS_KEY)) save(NOTIFICATIONS_KEY, []);
}

// ── Reset store (clear everything and re-seed) ────────────────────────────────
export function resetStore(): void {
  localStorage.removeItem(USERS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SUBMISSIONS_KEY);
  localStorage.removeItem(LOGS_KEY);
  localStorage.removeItem(COUNTER_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(NOTIFICATIONS_KEY);
  initStore();
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
  return getSubmissions().find((s) => s.ref === ref || s.serial === ref);
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
  const users = getAllUsers().map((u) =>
    u.id === userId ? { ...u, approved: true, role_approved: true } : u
  );
  save(USERS_KEY, users);
  // Mark related notifications as read
  const notifs = getNotifications().map((n) =>
    n.user_id === userId ? { ...n, read: true } : n
  );
  save(NOTIFICATIONS_KEY, notifs);
}

export function rejectUser(userId: string): void {
  save(USERS_KEY, getAllUsers().filter((u) => u.id !== userId));
  // Remove related notifications
  save(NOTIFICATIONS_KEY, getNotifications().filter((n) => n.user_id !== userId));
}

export function addUser(user: Omit<AppUser, "id" | "created_date">): AppUser {
  const newUser: AppUser = { ...user, id: nanoid(), created_date: new Date().toISOString() };
  save(USERS_KEY, [...getAllUsers(), newUser]);
  return newUser;
}

/**
 * Register a new user. If they select a consultant-level grade,
 * their role is set to "consultant" but role_approved = false,
 * and an admin notification is created.
 */
export function registerUser(data: {
  full_name: string;
  email: string;
  grade: string;
}): AppUser {
  const CONSULTANT_GRADES = ["Consultant", "Associate Specialist"];
  const isConsultant = CONSULTANT_GRADES.includes(data.grade);

  const newUser: AppUser = {
    id: nanoid(),
    full_name: data.full_name,
    email: data.email,
    grade: data.grade,
    role: isConsultant ? "consultant" : "clinician",
    approved: !isConsultant, // clinicians are auto-approved; consultants need admin approval
    role_approved: !isConsultant,
    created_date: new Date().toISOString(),
  };

  save(USERS_KEY, [...getAllUsers(), newUser]);

  // Create admin notification for consultant registrations
  if (isConsultant) {
    const notif: AppNotification = {
      id: nanoid(),
      type: "consultant_registration",
      message: `${data.full_name} (${data.grade}) has registered and is requesting consultant access.`,
      user_id: newUser.id,
      read: false,
      created_date: new Date().toISOString(),
    };
    save(NOTIFICATIONS_KEY, [...getNotifications(), notif]);
  }

  return newUser;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function getNotifications(): AppNotification[] {
  return load<AppNotification[]>(NOTIFICATIONS_KEY, []);
}

export function getUnreadNotificationCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function markNotificationRead(id: string): void {
  const notifs = getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  save(NOTIFICATIONS_KEY, notifs);
}

export function markAllNotificationsRead(): void {
  const notifs = getNotifications().map((n) => ({ ...n, read: true }));
  save(NOTIFICATIONS_KEY, notifs);
}
