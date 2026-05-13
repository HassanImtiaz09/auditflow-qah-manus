// SubmitAudit — Submit a new clinical audit proposal
// Design: Card-based form, clean labels, semantic validation errors

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Send, Plus, X } from "lucide-react";
import {
  AUDIT_CATEGORIES,
  CLINICAL_SETTINGS,
  PRIORITIES,
  GRADES,
  REAUDIT_OPTIONS,
} from "@/lib/auditConstants";
import { createSubmission, getSettings, type AppUser } from "@/lib/store";

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

interface FormData {
  auditor: string;
  grade: string;
  email: string;
  type: string;
  setting: string;
  priority: string;
  topic: string;
  period: string;
  sample: string;
  reaudit: string;
  description: string;
  collaborators: string[];
}

const EMPTY_FORM: FormData = {
  auditor: "",
  grade: "",
  email: "",
  type: "",
  setting: "",
  priority: "Routine",
  topic: "",
  period: "",
  sample: "",
  reaudit: "No",
  description: "",
  collaborators: [],
};

export default function SubmitAudit({ user, onRefresh }: Props) {
  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
    auditor: user.full_name,
    email: user.email,
    grade: user.role === "consultant" ? "Consultant" : "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [newCollab, setNewCollab] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const addCollaborator = () => {
    const trimmed = newCollab.trim();
    if (!trimmed) return;
    setForm((prev) => ({ ...prev, collaborators: [...prev.collaborators, trimmed] }));
    setNewCollab("");
  };

  const removeCollaborator = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((_, i) => i !== idx),
    }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.auditor.trim()) errs.auditor = "Auditor name is required";
    if (!form.grade) errs.grade = "Grade is required";
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.type) errs.type = "Category is required";
    if (!form.setting) errs.setting = "Clinical setting is required";
    if (!form.priority) errs.priority = "Priority is required";
    if (!form.description.trim()) errs.description = "Description is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!asDraft && !validate()) return;

    setSubmitting(true);
    try {
      const settings = getSettings();
      const submission = createSubmission(
        {
          ...form,
          status: asDraft ? "draft" : "pending",
          archived: false,
        },
        settings
      );
      toast.success(
        asDraft
          ? `Draft saved — ${submission.ref}`
          : `Audit submitted — ${submission.ref}`
      );
      setForm({
        ...EMPTY_FORM,
        auditor: user.full_name,
        email: user.email,
        grade: user.role === "consultant" ? "Consultant" : "",
      });
      onRefresh();
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Submit Audit Proposal</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Complete the form below to register a new clinical audit with the QAH ENT department.
      </p>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Auditor Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium">Auditor Name *</Label>
              <Input
                value={form.auditor}
                onChange={(e) => handleChange("auditor", e.target.value)}
                className={`mt-1 text-[13px] ${errors.auditor ? "border-red-400" : ""}`}
                placeholder="Full name"
              />
              {errors.auditor && <p className="text-red-500 text-[11px] mt-1">{errors.auditor}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Grade *</Label>
              <Select value={form.grade} onValueChange={(v) => handleChange("grade", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.grade ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.grade && <p className="text-red-500 text-[11px] mt-1">{errors.grade}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={`mt-1 text-[13px] ${errors.email ? "border-red-400" : ""}`}
                placeholder="nhs email"
              />
              {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Audit Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Category *</Label>
              <Select value={form.type} onValueChange={(v) => handleChange("type", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.type ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-red-500 text-[11px] mt-1">{errors.type}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Clinical Setting *</Label>
              <Select value={form.setting} onValueChange={(v) => handleChange("setting", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.setting ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Select setting" />
                </SelectTrigger>
                <SelectContent>
                  {CLINICAL_SETTINGS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.setting && <p className="text-red-500 text-[11px] mt-1">{errors.setting}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Priority *</Label>
              <Select value={form.priority} onValueChange={(v) => handleChange("priority", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.priority ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.priority && <p className="text-red-500 text-[11px] mt-1">{errors.priority}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium">Re-audit?</Label>
              <Select value={form.reaudit} onValueChange={(v) => handleChange("reaudit", v)}>
                <SelectTrigger className="mt-1 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REAUDIT_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Audit Topic</Label>
              <Input
                value={form.topic}
                onChange={(e) => handleChange("topic", e.target.value)}
                className="mt-1 text-[13px]"
                placeholder="Brief title"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Data Collection Period</Label>
              <Input
                value={form.period}
                onChange={(e) => handleChange("period", e.target.value)}
                className="mt-1 text-[13px]"
                placeholder="e.g. Jan–Mar 2025"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Expected Sample Size</Label>
              <Input
                value={form.sample}
                onChange={(e) => handleChange("sample", e.target.value)}
                className="mt-1 text-[13px]"
                placeholder="e.g. 50 patients"
              />
            </div>
          </div>

          {/* Collaborators */}
          <div className="mt-5">
            <Label className="text-xs font-medium">Collaborators</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newCollab}
                onChange={(e) => setNewCollab(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCollaborator(); } }}
                className="text-[13px] flex-1"
                placeholder="Add collaborator name and press Enter"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCollaborator}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {form.collaborators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.collaborators.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-[12px] px-2.5 py-1 rounded-full border border-blue-200"
                  >
                    {c}
                    <button type="button" onClick={() => removeCollaborator(i)}>
                      <X className="w-3 h-3 text-blue-500 hover:text-blue-800" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-5">
            <Label className="text-xs font-medium">Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className={`mt-1 text-[13px] min-h-[100px] ${errors.description ? "border-red-400" : ""}`}
              placeholder="Describe the audit aims, standards being measured, and methodology..."
            />
            {errors.description && (
              <p className="text-red-500 text-[11px] mt-1">{errors.description}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => handleSubmit(e, true)}
            disabled={submitting}
            className="text-slate-600"
          >
            <Save className="w-4 h-4 mr-1" />
            Save Draft
          </Button>
          <Button type="submit" disabled={submitting} className="px-6">
            <Send className="w-4 h-4 mr-1" />
            {submitting ? "Submitting..." : "Submit Audit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
