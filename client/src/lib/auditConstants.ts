// AuditFlow QAH — Shared Constants
// Design: NHS Clinical Precision — deep navy sidebar, cool off-white canvas, semantic status colours

export const AUDIT_CATEGORIES = [
  { label: "Otology", code: "OTO" },
  { label: "Rhinology", code: "RHI" },
  { label: "Head & Neck", code: "HAN" },
  { label: "Laryngology", code: "LAR" },
  { label: "Paediatric ENT", code: "PED" },
  { label: "Thyroid & Endocrine", code: "THY" },
  { label: "Audiology", code: "AUD" },
  { label: "General ENT", code: "GEN" },
  { label: "MDT / Governance", code: "MDT" },
  { label: "Other", code: "OTH" },
];

export const CLINICAL_SETTINGS = [
  "Outpatient clinic",
  "Inpatient ward",
  "Theatre / surgical",
  "Day surgery unit",
  "Emergency / A&E",
  "MDT meeting",
  "Departmental",
  "Trust-wide",
];

export const PRIORITIES = ["Routine", "Standard", "High", "Urgent"] as const;
export type Priority = typeof PRIORITIES[number];

export const GRADES = [
  "Consultant",
  "Associate Specialist",
  "Registrar (SpR)",
  "SHO / CT",
  "Foundation doctor",
  "Specialist nurse",
  "Audiologist",
  "AHP",
  "Audit coordinator",
  "Medical student",
];

export const REAUDIT_OPTIONS = [
  "No",
  "Yes - 1st re-audit",
  "Yes - 2nd re-audit",
  "Yes - 3rd+ re-audit",
];

export const ROLES = ["clinician", "consultant", "admin"] as const;
export type Role = typeof ROLES[number];

export type AuditStatus = "draft" | "pending" | "approved" | "rejected" | "changes_requested";

export const STATUS_COLORS: Record<AuditStatus, { bg: string; text: string; border: string }> = {
  draft:             { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
  pending:           { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-200" },
  approved:          { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  rejected:          { bg: "bg-red-100",     text: "text-red-800",     border: "border-red-200" },
  changes_requested: { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-200" },
};

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Routine:  { bg: "bg-emerald-100", text: "text-emerald-800" },
  Standard: { bg: "bg-blue-100",    text: "text-blue-800" },
  High:     { bg: "bg-amber-100",   text: "text-amber-800" },
  Urgent:   { bg: "bg-red-100",     text: "text-red-800" },
};

export function getCategoryCode(label: string): string {
  const cat = AUDIT_CATEGORIES.find((c) => c.label === label);
  return cat ? cat.code : "OTH";
}

export function generateRef(totalSubmissions: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(totalSubmissions + 1).padStart(4, "0");
  return `REF-${y}${m}${d}-${seq}`;
}

export function generateSerial(
  prefix: string,
  year: number,
  categoryCode: string,
  counterValue: number
): string {
  const seq = String(counterValue).padStart(4, "0");
  return `${prefix}-${year}-${categoryCode}-${seq}`;
}
