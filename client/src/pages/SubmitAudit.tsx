// SubmitAudit — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Send, Plus, X, CheckCircle2 } from "lucide-react";
import { AUDIT_CATEGORIES, CLINICAL_SETTINGS, PRIORITIES, GRADES, REAUDIT_OPTIONS } from "@/lib/auditConstants";
import { trpc } from "@/lib/trpc";

interface FormData {
  auditor: string; grade: string; email: string; type: string; setting: string;
  priority: string; topic: string; period: string; sample: string; reaudit: string;
  description: string; collaborators: string[]; supervisorId: number | null;
}

const EMPTY: FormData = {
  auditor: "", grade: "", email: "", type: "", setting: "", priority: "Routine",
  topic: "", period: "", sample: "", reaudit: "No", description: "", collaborators: [], supervisorId: null,
};

export default function SubmitAudit() {
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const { data: consultants = [] } = trpc.audits.consultants.useQuery();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [newCollab, setNewCollab] = useState("");
  const [lastRef, setLastRef] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  if (currentUser && !prefilled) {
    setPrefilled(true);
    setForm(p => ({ ...p, auditor: currentUser.fullName ?? "", email: currentUser.email ?? "", grade: currentUser.grade ?? "" }));
  }

  const submitMutation = trpc.audits.submit.useMutation({
    onSuccess: (data) => {
      setLastRef(data.refNumber);
      toast.success(`Audit submitted — ${data.refNumber}`);
      setForm({ ...EMPTY, auditor: currentUser?.fullName ?? "", email: currentUser?.email ?? "", grade: currentUser?.grade ?? "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const hc = (field: keyof FormData, value: string) => {
    setForm(p => ({ ...p, [field]: value }));
    if (errors[field]) setErrors(p => ({ ...p, [field]: undefined }));
  };
  const addC = () => { const t = newCollab.trim(); if (!t) return; setForm(p => ({ ...p, collaborators: [...p.collaborators, t] })); setNewCollab(""); };
  const remC = (i: number) => setForm(p => ({ ...p, collaborators: p.collaborators.filter((_, j) => j !== i) }));

  const validate = () => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.auditor.trim()) e.auditor = "Required";
    if (!form.grade) e.grade = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.type) e.type = "Required";
    if (!form.setting) e.setting = "Required";
    if (!form.priority) e.priority = "Required";
    if (!form.description.trim()) e.description = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (e: React.FormEvent, draft = false) => {
    e.preventDefault();
    if (!draft && !validate()) return;
    const validPriorities = ["Routine", "Standard", "High", "Urgent"] as const;
    type Priority = typeof validPriorities[number];
    const priority: Priority = validPriorities.includes(form.priority as Priority) ? form.priority as Priority : "Routine";
    submitMutation.mutate({
      category: form.type,
      clinicalSetting: form.setting, priority, topic: form.topic || "Untitled",
      dataCollectionPeriod: form.period, expectedSampleSize: form.sample,
      reaudit: form.reaudit, description: form.description || "No description provided.",
      collaborators: form.collaborators, supervisorId: form.supervisorId ?? undefined, isDraft: draft,
    });
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Submit Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">Register a new clinical audit proposal.</p>
      </div>
      {lastRef && (
        <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Submitted successfully</p>
            <p className="text-xs text-emerald-700">Ref: <span className="font-mono font-semibold">{lastRef}</span></p>
          </div>
        </div>
      )}
      <form onSubmit={(e) => onSubmit(e, false)}>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-4">
          <h3 className="text-sm font-semibold mb-4">Auditor Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Auditor Name *</Label>
              <Input value={form.auditor} onChange={e => hc("auditor", e.target.value)} className={`mt-1 text-[13px] ${errors.auditor ? "border-red-400" : ""}`} placeholder="Full name" />
              {errors.auditor && <p className="text-red-500 text-[11px] mt-1">{errors.auditor}</p>}
            </div>
            <div>
              <Label className="text-xs">Grade *</Label>
              <Select value={form.grade} onValueChange={v => hc("grade", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.grade ? "border-red-400" : ""}`}><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
              {errors.grade && <p className="text-red-500 text-[11px] mt-1">{errors.grade}</p>}
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => hc("email", e.target.value)} className={`mt-1 text-[13px] ${errors.email ? "border-red-400" : ""}`} placeholder="nhs email" />
              {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-4">
          <h3 className="text-sm font-semibold mb-1">Supervising Consultant</h3>
          <p className="text-xs text-muted-foreground mb-4">Select the consultant who will supervise and approve this audit.</p>
          <Select value={form.supervisorId ? String(form.supervisorId) : "none"} onValueChange={v => setForm(p => ({ ...p, supervisorId: v === "none" ? null : Number(v) }))}>
            <SelectTrigger className="text-[13px]"><SelectValue placeholder="Select supervising consultant (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No supervisor assigned</SelectItem>
              {consultants.map(c => {
                // grade is stored as "Consultant — Specialty"; extract just the specialty
                const specialty = c.grade.replace(/^Consultant\s*[—\-]\s*/i, "").trim();
                const label = specialty ? `${c.fullName} (${specialty})` : c.fullName;
                return <SelectItem key={c.id} value={String(c.id)}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          {consultants.length === 0 && <p className="text-xs text-muted-foreground mt-2">No approved consultants registered yet.</p>}
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-4">
          <h3 className="text-sm font-semibold mb-4">Audit Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={form.type} onValueChange={v => hc("type", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.type ? "border-red-400" : ""}`}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{AUDIT_CATEGORIES.map(c => <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
              {errors.type && <p className="text-red-500 text-[11px] mt-1">{errors.type}</p>}
            </div>
            <div>
              <Label className="text-xs">Clinical Setting *</Label>
              <Select value={form.setting} onValueChange={v => hc("setting", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.setting ? "border-red-400" : ""}`}><SelectValue placeholder="Select setting" /></SelectTrigger>
                <SelectContent>{CLINICAL_SETTINGS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {errors.setting && <p className="text-red-500 text-[11px] mt-1">{errors.setting}</p>}
            </div>
            <div>
              <Label className="text-xs">Priority *</Label>
              <Select value={form.priority} onValueChange={v => hc("priority", v)}>
                <SelectTrigger className={`mt-1 text-[13px] ${errors.priority ? "border-red-400" : ""}`}><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              {errors.priority && <p className="text-red-500 text-[11px] mt-1">{errors.priority}</p>}
            </div>
            <div>
              <Label className="text-xs">Re-audit?</Label>
              <Select value={form.reaudit} onValueChange={v => hc("reaudit", v)}>
                <SelectTrigger className="mt-1 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>{REAUDIT_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Audit Topic</Label>
              <Input value={form.topic} onChange={e => hc("topic", e.target.value)} className="mt-1 text-[13px]" placeholder="Brief title" />
            </div>
            <div>
              <Label className="text-xs">Data Collection Period</Label>
              <Input value={form.period} onChange={e => hc("period", e.target.value)} className="mt-1 text-[13px]" placeholder="e.g. Jan–Mar 2025" />
            </div>
            <div>
              <Label className="text-xs">Expected Sample Size</Label>
              <Input value={form.sample} onChange={e => hc("sample", e.target.value)} className="mt-1 text-[13px]" placeholder="e.g. 50 patients" />
            </div>
          </div>
          <div className="mt-5">
            <Label className="text-xs">Collaborators</Label>
            <div className="flex gap-2 mt-1">
              <Input value={newCollab} onChange={e => setNewCollab(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addC(); } }} className="text-[13px] flex-1" placeholder="Add name and press Enter" />
              <Button type="button" variant="outline" size="sm" onClick={addC}><Plus className="w-4 h-4" /></Button>
            </div>
            {form.collaborators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.collaborators.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-[12px] px-2.5 py-1 rounded-full border border-blue-200">
                    {c}<button type="button" onClick={() => remC(i)}><X className="w-3 h-3 text-blue-500" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5">
            <Label className="text-xs">Description *</Label>
            <Textarea value={form.description} onChange={e => hc("description", e.target.value)} className={`mt-1 text-[13px] min-h-[100px] ${errors.description ? "border-red-400" : ""}`} placeholder="Describe the audit aims, standards, and methodology..." />
            {errors.description && <p className="text-red-500 text-[11px] mt-1">{errors.description}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={e => onSubmit(e, true)} disabled={submitMutation.isPending}>
            <Save className="w-4 h-4 mr-1" />Save Draft
          </Button>
          <Button type="submit" disabled={submitMutation.isPending} className="px-6">
            <Send className="w-4 h-4 mr-1" />{submitMutation.isPending ? "Submitting..." : "Submit Audit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
