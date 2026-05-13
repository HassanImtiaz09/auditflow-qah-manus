// SubmitAudit — Multi-Step Clinical Audit Registration Wizard
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Save, Send, Plus, X, ChevronRight, ChevronLeft, CheckCircle2, Trash2, FileText } from "lucide-react";
import { AUDIT_CATEGORIES, CLINICAL_SETTINGS, PRIORITIES, GRADES, REAUDIT_OPTIONS } from "@/lib/auditConstants";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditStandardRow {
  standard: string;
  criteria: string;
  compliance: string;
  exceptions: string;
}

interface WizardData {
  // Step 1 — Basic Details
  auditor: string;
  grade: string;
  email: string;
  category: string;
  clinicalSetting: string;
  priority: string;
  reaudit: string;
  topic: string;
  dataCollectionPeriod: string;
  expectedSampleSize: string;
  collaborators: string[];
  description: string;
  supervisorId: number | null;

  // Step 2 — Clinical Audit Registration
  reasonForAudit: string[];
  reasonForAuditOther: string;
  cqcRegulation: string;
  priorityType: "national" | "regional" | "local" | "";
  priorityTypeOther: string;
  supportRequired: string[];
  supportRequiredOther: string;
  auditStartDate: string;
  auditEndDate: string;
  auditObjectives: string;
  whoInvolved: string;
  auditStandards: AuditStandardRow[];
  evidenceBase: string;
  stakeholders: string;
  stakeholdersInformed: boolean;
  dataSource: string[];
  dataSourceOther: string;
  dataCollectionMethodDetail: string;
  dataCollectionTiming: "retrospective" | "prospective" | "";
  dataCollectedBy: string;
  samplingMethodDetail: string;
  dataAnalysisDetail: string;
  dataAnalysedBy: string;
  resultsPresentation: string[];
  resultsPresentationOther: string;
  actionPlanOwner: string;
  barriersToChange: string;
  reAuditTimeline: "na" | "6months" | "12months" | "other" | "";
  reAuditTimelineOther: string;
}

const EMPTY_STANDARD: AuditStandardRow = { standard: "", criteria: "", compliance: "", exceptions: "" };

const EMPTY_WIZARD: WizardData = {
  auditor: "", grade: "", email: "", category: "", clinicalSetting: "", priority: "Routine",
  reaudit: "No", topic: "", dataCollectionPeriod: "", expectedSampleSize: "",
  collaborators: [], description: "", supervisorId: null,
  reasonForAudit: [], reasonForAuditOther: "", cqcRegulation: "", priorityType: "",
  priorityTypeOther: "", supportRequired: [], supportRequiredOther: "",
  auditStartDate: "", auditEndDate: "", auditObjectives: "", whoInvolved: "",
  auditStandards: [{ ...EMPTY_STANDARD }], evidenceBase: "", stakeholders: "",
  stakeholdersInformed: false, dataSource: [], dataSourceOther: "",
  dataCollectionMethodDetail: "", dataCollectionTiming: "", dataCollectedBy: "",
  samplingMethodDetail: "", dataAnalysisDetail: "", dataAnalysedBy: "",
  resultsPresentation: [], resultsPresentationOther: "", actionPlanOwner: "",
  barriersToChange: "", reAuditTimeline: "", reAuditTimelineOther: "",
};

const REASON_OPTIONS = [
  "NICE guidance", "National audit programme", "Royal College guidance",
  "Regional priority", "Local priority", "Patient safety concern",
  "CQC requirement", "Re-audit", "Other",
];

const SUPPORT_OPTIONS = [
  "Statistical advice", "IT / data extraction", "Patient and public involvement",
  "Library / literature search", "Finance", "Other",
];

const DATA_SOURCE_OPTIONS = [
  "Patient records (paper)", "Electronic patient record (EPR)", "Theatre log",
  "Radiology system", "Pathology system", "Questionnaire / survey",
  "Observation", "Other",
];

const RESULTS_PRESENTATION_OPTIONS = [
  "Stakeholders / management", "Clinical care team", "Service users / patients",
  "Departmental meeting", "Trust governance meeting", "External publication", "Other",
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Basic Details" },
    { n: 2, label: "Registration Form" },
    { n: 3, label: "Review & Submit" },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            step === s.n ? "bg-blue-600 text-white" :
            step > s.n ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}>
            {step > s.n ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 flex items-center justify-center rounded-full border border-current text-[10px]">{s.n}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && <div className={`h-px w-8 mx-1 ${step > s.n ? "bg-emerald-300" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Checkbox Group ───────────────────────────────────────────────────────────

function CheckboxGroup({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]);
  };
  return (
    <div>
      <Label className="text-xs mb-2 block">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({
  data, onChange, errors, consultants,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  errors: Partial<Record<string, string>>;
  consultants: { id: number; fullName: string; grade: string }[];
}) {
  const [newCollab, setNewCollab] = useState("");
  const addC = () => {
    const t = newCollab.trim();
    if (!t) return;
    onChange({ collaborators: [...data.collaborators, t] });
    setNewCollab("");
  };
  const remC = (i: number) => onChange({ collaborators: data.collaborators.filter((_, j) => j !== i) });

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Auditor Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Auditor Name *</Label>
            <Input value={data.auditor} onChange={e => onChange({ auditor: e.target.value })} className={`mt-1 text-[13px] ${errors.auditor ? "border-red-400" : ""}`} placeholder="Full name" />
            {errors.auditor && <p className="text-red-500 text-[11px] mt-1">{errors.auditor}</p>}
          </div>
          <div>
            <Label className="text-xs">Grade *</Label>
            <Select value={data.grade} onValueChange={v => onChange({ grade: v })}>
              <SelectTrigger className={`mt-1 text-[13px] ${errors.grade ? "border-red-400" : ""}`}><SelectValue placeholder="Select grade" /></SelectTrigger>
              <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
            {errors.grade && <p className="text-red-500 text-[11px] mt-1">{errors.grade}</p>}
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={data.email} onChange={e => onChange({ email: e.target.value })} className={`mt-1 text-[13px] ${errors.email ? "border-red-400" : ""}`} placeholder="NHS email" />
            {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-1">Supervising Consultant</h3>
        <p className="text-xs text-muted-foreground mb-4">Select the consultant who will supervise and approve this audit.</p>
        <Select value={data.supervisorId ? String(data.supervisorId) : "none"} onValueChange={v => onChange({ supervisorId: v === "none" ? null : Number(v) })}>
          <SelectTrigger className="text-[13px]"><SelectValue placeholder="Select supervising consultant (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No supervisor assigned</SelectItem>
            {consultants.map(c => {
              const specialty = c.grade.replace(/^Consultant\s*[—\-]\s*/i, "").trim();
              const label = specialty ? `${c.fullName} (${specialty})` : c.fullName;
              return <SelectItem key={c.id} value={String(c.id)}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Audit Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Category *</Label>
            <Select value={data.category} onValueChange={v => onChange({ category: v })}>
              <SelectTrigger className={`mt-1 text-[13px] ${errors.category ? "border-red-400" : ""}`}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{AUDIT_CATEGORIES.map(c => <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            {errors.category && <p className="text-red-500 text-[11px] mt-1">{errors.category}</p>}
          </div>
          <div>
            <Label className="text-xs">Clinical Setting *</Label>
            <Select value={data.clinicalSetting} onValueChange={v => onChange({ clinicalSetting: v })}>
              <SelectTrigger className={`mt-1 text-[13px] ${errors.clinicalSetting ? "border-red-400" : ""}`}><SelectValue placeholder="Select setting" /></SelectTrigger>
              <SelectContent>{CLINICAL_SETTINGS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            {errors.clinicalSetting && <p className="text-red-500 text-[11px] mt-1">{errors.clinicalSetting}</p>}
          </div>
          <div>
            <Label className="text-xs">Priority *</Label>
            <Select value={data.priority} onValueChange={v => onChange({ priority: v })}>
              <SelectTrigger className={`mt-1 text-[13px] ${errors.priority ? "border-red-400" : ""}`}><SelectValue placeholder="Select priority" /></SelectTrigger>
              <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            {errors.priority && <p className="text-red-500 text-[11px] mt-1">{errors.priority}</p>}
          </div>
          <div>
            <Label className="text-xs">Re-audit?</Label>
            <Select value={data.reaudit} onValueChange={v => onChange({ reaudit: v })}>
              <SelectTrigger className="mt-1 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>{REAUDIT_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Audit Title *</Label>
            <Input value={data.topic} onChange={e => onChange({ topic: e.target.value })} className={`mt-1 text-[13px] ${errors.topic ? "border-red-400" : ""}`} placeholder="Brief descriptive title" />
            {errors.topic && <p className="text-red-500 text-[11px] mt-1">{errors.topic}</p>}
          </div>
          <div>
            <Label className="text-xs">Data Collection Period</Label>
            <Input value={data.dataCollectionPeriod} onChange={e => onChange({ dataCollectionPeriod: e.target.value })} className="mt-1 text-[13px]" placeholder="e.g. Jan–Mar 2025" />
          </div>
          <div>
            <Label className="text-xs">Expected Sample Size</Label>
            <Input value={data.expectedSampleSize} onChange={e => onChange({ expectedSampleSize: e.target.value })} className="mt-1 text-[13px]" placeholder="e.g. 50 patients" />
          </div>
        </div>
        <div className="mt-5">
          <Label className="text-xs">Collaborators</Label>
          <div className="flex gap-2 mt-1">
            <Input value={newCollab} onChange={e => setNewCollab(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addC(); } }} className="text-[13px] flex-1" placeholder="Add name and press Enter" />
            <Button type="button" variant="outline" size="sm" onClick={addC}><Plus className="w-4 h-4" /></Button>
          </div>
          {data.collaborators.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {data.collaborators.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-[12px] px-2.5 py-1 rounded-full border border-blue-200">
                  {c}<button type="button" onClick={() => remC(i)}><X className="w-3 h-3 text-blue-500" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5">
          <Label className="text-xs">Brief Description *</Label>
          <Textarea value={data.description} onChange={e => onChange({ description: e.target.value })} className={`mt-1 text-[13px] min-h-[80px] ${errors.description ? "border-red-400" : ""}`} placeholder="Briefly describe the audit aims..." />
          {errors.description && <p className="text-red-500 text-[11px] mt-1">{errors.description}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ data, onChange }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void }) {
  const updateStandard = (i: number, field: keyof AuditStandardRow, value: string) => {
    const updated = data.auditStandards.map((row, idx) => idx === i ? { ...row, [field]: value } : row);
    onChange({ auditStandards: updated });
  };
  const addStandard = () => onChange({ auditStandards: [...data.auditStandards, { ...EMPTY_STANDARD }] });
  const removeStandard = (i: number) => onChange({ auditStandards: data.auditStandards.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      {/* Reason for Audit */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Reason for Audit</h3>
        <CheckboxGroup label="Select all that apply" options={REASON_OPTIONS} selected={data.reasonForAudit} onChange={v => onChange({ reasonForAudit: v })} />
        {data.reasonForAudit.includes("Other") && (
          <div className="mt-3">
            <Label className="text-xs">Please specify</Label>
            <Input value={data.reasonForAuditOther} onChange={e => onChange({ reasonForAuditOther: e.target.value })} className="mt-1 text-[13px]" placeholder="Specify other reason" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">CQC Regulation (if applicable)</Label>
            <Input value={data.cqcRegulation} onChange={e => onChange({ cqcRegulation: e.target.value })} className="mt-1 text-[13px]" placeholder="e.g. Regulation 12 — Safe care" />
          </div>
          <div>
            <Label className="text-xs">Priority Classification</Label>
            <RadioGroup value={data.priorityType} onValueChange={v => onChange({ priorityType: v as WizardData["priorityType"] })} className="flex gap-4 mt-2">
              {(["national", "regional", "local"] as const).map(p => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer capitalize">
                  <RadioGroupItem value={p} />{p}
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>
      </div>

      {/* Support Required */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Support Required</h3>
        <CheckboxGroup label="Select any support needed" options={SUPPORT_OPTIONS} selected={data.supportRequired} onChange={v => onChange({ supportRequired: v })} />
        {data.supportRequired.includes("Other") && (
          <div className="mt-3">
            <Label className="text-xs">Please specify</Label>
            <Input value={data.supportRequiredOther} onChange={e => onChange({ supportRequiredOther: e.target.value })} className="mt-1 text-[13px]" placeholder="Specify other support" />
          </div>
        )}
      </div>

      {/* Dates & Objectives */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Timeline & Objectives</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-xs">Planned Start Date</Label>
            <Input type="date" value={data.auditStartDate} onChange={e => onChange({ auditStartDate: e.target.value })} className="mt-1 text-[13px]" />
          </div>
          <div>
            <Label className="text-xs">Planned End Date</Label>
            <Input type="date" value={data.auditEndDate} onChange={e => onChange({ auditEndDate: e.target.value })} className="mt-1 text-[13px]" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Audit Objectives</Label>
          <Textarea value={data.auditObjectives} onChange={e => onChange({ auditObjectives: e.target.value })} className="mt-1 text-[13px] min-h-[80px]" placeholder="What outcomes does this audit aim to achieve?" />
        </div>
        <div className="mt-4">
          <Label className="text-xs">Who Will Be Involved and Their Role</Label>
          <Textarea value={data.whoInvolved} onChange={e => onChange({ whoInvolved: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="e.g. Lead auditor, data collector, supervisor..." />
        </div>
      </div>

      {/* Audit Standards */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Audit Standards</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStandard}><Plus className="w-3.5 h-3.5 mr-1" />Add Row</Button>
        </div>
        <div className="space-y-4">
          {data.auditStandards.map((row, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg relative">
              <div>
                <Label className="text-[11px]">Standard</Label>
                <Input value={row.standard} onChange={e => updateStandard(i, "standard", e.target.value)} className="mt-1 text-[12px]" placeholder="e.g. NICE NG15" />
              </div>
              <div>
                <Label className="text-[11px]">Criteria</Label>
                <Input value={row.criteria} onChange={e => updateStandard(i, "criteria", e.target.value)} className="mt-1 text-[12px]" placeholder="What should happen" />
              </div>
              <div>
                <Label className="text-[11px]">Target Compliance %</Label>
                <Input value={row.compliance} onChange={e => updateStandard(i, "compliance", e.target.value)} className="mt-1 text-[12px]" placeholder="e.g. 95%" />
              </div>
              <div>
                <Label className="text-[11px]">Exceptions</Label>
                <div className="flex gap-1">
                  <Input value={row.exceptions} onChange={e => updateStandard(i, "exceptions", e.target.value)} className="mt-1 text-[12px]" placeholder="If any" />
                  {data.auditStandards.length > 1 && (
                    <button type="button" onClick={() => removeStandard(i)} className="mt-1 p-1.5 text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Label className="text-xs">Evidence Base for Standards</Label>
          <Textarea value={data.evidenceBase} onChange={e => onChange({ evidenceBase: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="NICE, Royal College guidelines, local policy..." />
        </div>
      </div>

      {/* Stakeholders */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Stakeholders</h3>
        <div>
          <Label className="text-xs">List Stakeholders</Label>
          <Textarea value={data.stakeholders} onChange={e => onChange({ stakeholders: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="e.g. Clinical director, ward nurses, patients..." />
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
          <Checkbox checked={data.stakeholdersInformed} onCheckedChange={v => onChange({ stakeholdersInformed: !!v })} />
          Stakeholders have been informed about this audit
        </label>
      </div>

      {/* Data Collection */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Data Collection</h3>
        <CheckboxGroup label="Data Source" options={DATA_SOURCE_OPTIONS} selected={data.dataSource} onChange={v => onChange({ dataSource: v })} />
        {data.dataSource.includes("Other") && (
          <div className="mt-3">
            <Label className="text-xs">Please specify</Label>
            <Input value={data.dataSourceOther} onChange={e => onChange({ dataSourceOther: e.target.value })} className="mt-1 text-[13px]" placeholder="Specify other data source" />
          </div>
        )}
        <div className="mt-4">
          <Label className="text-xs">Data Collection Method</Label>
          <Textarea value={data.dataCollectionMethodDetail} onChange={e => onChange({ dataCollectionMethodDetail: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="Describe how data will be collected..." />
        </div>
        <div className="mt-4">
          <Label className="text-xs mb-2 block">Data Collection Timing</Label>
          <RadioGroup value={data.dataCollectionTiming} onValueChange={v => onChange({ dataCollectionTiming: v as WizardData["dataCollectionTiming"] })} className="flex gap-6">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <RadioGroupItem value="retrospective" />Retrospective
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <RadioGroupItem value="prospective" />Prospective
            </label>
          </RadioGroup>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Data Collected By</Label>
            <Input value={data.dataCollectedBy} onChange={e => onChange({ dataCollectedBy: e.target.value })} className="mt-1 text-[13px]" placeholder="Name / role" />
          </div>
          <div>
            <Label className="text-xs">Sampling Method</Label>
            <Input value={data.samplingMethodDetail} onChange={e => onChange({ samplingMethodDetail: e.target.value })} className="mt-1 text-[13px]" placeholder="e.g. Consecutive, random..." />
          </div>
        </div>
      </div>

      {/* Data Analysis */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Data Analysis</h3>
        <div>
          <Label className="text-xs">Analysis Description</Label>
          <Textarea value={data.dataAnalysisDetail} onChange={e => onChange({ dataAnalysisDetail: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="How will data be analysed?" />
        </div>
        <div className="mt-4">
          <Label className="text-xs">Data Analysed By</Label>
          <Input value={data.dataAnalysedBy} onChange={e => onChange({ dataAnalysedBy: e.target.value })} className="mt-1 text-[13px]" placeholder="Name / role" />
        </div>
      </div>

      {/* Results & Action Plan */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Results Dissemination & Action Plan</h3>
        <CheckboxGroup label="Results will be presented to" options={RESULTS_PRESENTATION_OPTIONS} selected={data.resultsPresentation} onChange={v => onChange({ resultsPresentation: v })} />
        {data.resultsPresentation.includes("Other") && (
          <div className="mt-3">
            <Label className="text-xs">Please specify</Label>
            <Input value={data.resultsPresentationOther} onChange={e => onChange({ resultsPresentationOther: e.target.value })} className="mt-1 text-[13px]" placeholder="Specify other audience" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Action Plan Owner</Label>
            <Input value={data.actionPlanOwner} onChange={e => onChange({ actionPlanOwner: e.target.value })} className="mt-1 text-[13px]" placeholder="Name / role" />
          </div>
          <div>
            <Label className="text-xs">Re-audit Timeline</Label>
            <Select value={data.reAuditTimeline} onValueChange={v => onChange({ reAuditTimeline: v as WizardData["reAuditTimeline"] })}>
              <SelectTrigger className="mt-1 text-[13px]"><SelectValue placeholder="Select timeline" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="na">Not applicable</SelectItem>
                <SelectItem value="6months">6 months</SelectItem>
                <SelectItem value="12months">12 months</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {data.reAuditTimeline === "other" && (
              <Input value={data.reAuditTimelineOther} onChange={e => onChange({ reAuditTimelineOther: e.target.value })} className="mt-2 text-[13px]" placeholder="Specify timeline" />
            )}
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-xs">Potential Barriers to Change</Label>
          <Textarea value={data.barriersToChange} onChange={e => onChange({ barriersToChange: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="Describe any anticipated barriers..." />
        </div>
      </div>
    </div>
  );
}

// ─── Review Row ───────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="text-xs font-medium flex-1">{Array.isArray(value) ? value.join(", ") : value}</span>
    </div>
  );
}

// ─── Step 3 — Review ─────────────────────────────────────────────────────────

function Step3({ data, consultants, onEdit }: {
  data: WizardData;
  consultants: { id: number; fullName: string; grade: string }[];
  onEdit: (step: 1 | 2) => void;
}) {
  const supervisor = consultants.find(c => c.id === data.supervisorId);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">Please review all details carefully before submitting. Once submitted, the audit will be sent for consultant approval.</p>
      </div>

      {/* Step 1 Summary */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Basic Details</h3>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={() => onEdit(1)}>Edit</Button>
        </div>
        <ReviewRow label="Auditor" value={data.auditor} />
        <ReviewRow label="Grade" value={data.grade} />
        <ReviewRow label="Email" value={data.email} />
        <ReviewRow label="Supervising Consultant" value={supervisor ? supervisor.fullName : "None assigned"} />
        <ReviewRow label="Category" value={data.category} />
        <ReviewRow label="Clinical Setting" value={data.clinicalSetting} />
        <ReviewRow label="Priority" value={data.priority} />
        <ReviewRow label="Re-audit" value={data.reaudit} />
        <ReviewRow label="Audit Title" value={data.topic} />
        <ReviewRow label="Data Collection Period" value={data.dataCollectionPeriod} />
        <ReviewRow label="Expected Sample Size" value={data.expectedSampleSize} />
        <ReviewRow label="Collaborators" value={data.collaborators} />
        <ReviewRow label="Description" value={data.description} />
      </div>

      {/* Step 2 Summary */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Clinical Audit Registration</h3>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-blue-600 h-7" onClick={() => onEdit(2)}>Edit</Button>
        </div>
        <ReviewRow label="Reason for Audit" value={[...data.reasonForAudit, ...(data.reasonForAuditOther ? [data.reasonForAuditOther] : [])]} />
        <ReviewRow label="CQC Regulation" value={data.cqcRegulation} />
        <ReviewRow label="Priority Type" value={data.priorityType} />
        <ReviewRow label="Support Required" value={[...data.supportRequired, ...(data.supportRequiredOther ? [data.supportRequiredOther] : [])]} />
        <ReviewRow label="Start Date" value={data.auditStartDate} />
        <ReviewRow label="End Date" value={data.auditEndDate} />
        <ReviewRow label="Objectives" value={data.auditObjectives} />
        <ReviewRow label="Who Involved" value={data.whoInvolved} />
        <ReviewRow label="Evidence Base" value={data.evidenceBase} />
        <ReviewRow label="Stakeholders" value={data.stakeholders} />
        <ReviewRow label="Stakeholders Informed" value={data.stakeholdersInformed ? "Yes" : "No"} />
        <ReviewRow label="Data Source" value={[...data.dataSource, ...(data.dataSourceOther ? [data.dataSourceOther] : [])]} />
        <ReviewRow label="Collection Method" value={data.dataCollectionMethodDetail} />
        <ReviewRow label="Collection Timing" value={data.dataCollectionTiming} />
        <ReviewRow label="Data Collected By" value={data.dataCollectedBy} />
        <ReviewRow label="Sampling Method" value={data.samplingMethodDetail} />
        <ReviewRow label="Analysis Description" value={data.dataAnalysisDetail} />
        <ReviewRow label="Data Analysed By" value={data.dataAnalysedBy} />
        <ReviewRow label="Results Presented To" value={[...data.resultsPresentation, ...(data.resultsPresentationOther ? [data.resultsPresentationOther] : [])]} />
        <ReviewRow label="Action Plan Owner" value={data.actionPlanOwner} />
        <ReviewRow label="Barriers to Change" value={data.barriersToChange} />
        <ReviewRow label="Re-audit Timeline" value={data.reAuditTimeline === "other" ? data.reAuditTimelineOther : data.reAuditTimeline} />
        {data.auditStandards.filter(s => s.standard).length > 0 && (
          <div className="mt-3">
            <span className="text-xs text-muted-foreground">Audit Standards</span>
            <div className="mt-2 space-y-2">
              {data.auditStandards.filter(s => s.standard).map((s, i) => (
                <div key={i} className="text-xs bg-muted/40 rounded p-2">
                  <span className="font-medium">{s.standard}</span>
                  {s.criteria && <span className="text-muted-foreground"> — {s.criteria}</span>}
                  {s.compliance && <span className="ml-2 text-blue-600">Target: {s.compliance}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Wizard Shell ─────────────────────────────────────────────────────────────

export default function SubmitAudit() {
  const [, navigate] = useLocation();
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const { data: consultants = [] } = trpc.audits.consultants.useQuery();
  const utils = trpc.useUtils();

  // Parse draftId from URL query string
  const urlDraftId = typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("draftId")) || null
    : null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [prefilled, setPrefilled] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(urlDraftId);
  const [lastRef, setLastRef] = useState<string | null>(null);

  // Load draft from server if draftId is in URL
  const { data: draftData } = trpc.audits.getDraft.useQuery(
    { auditId: draftId! },
    { enabled: !!draftId && !draftLoaded }
  );

  useEffect(() => {
    if (draftData && !draftLoaded) {
      setDraftLoaded(true);
      const d = draftData;
      setData({
        auditor: d.submitterName ?? "",
        grade: d.submitterGrade ?? "",
        email: d.submitterEmail ?? "",
        category: d.category ?? "",
        clinicalSetting: d.clinicalSetting ?? "",
        priority: d.priority ?? "Routine",
        reaudit: d.reaudit ?? "No",
        topic: d.topic ?? "",
        dataCollectionPeriod: d.dataCollectionPeriod ?? "",
        expectedSampleSize: d.expectedSampleSize ?? "",
        collaborators: Array.isArray(d.collaborators) ? d.collaborators : [],
        description: d.description ?? "",
        supervisorId: d.supervisorId ?? null,
        reasonForAudit: Array.isArray(d.reasonForAudit) ? d.reasonForAudit : [],
        reasonForAuditOther: d.reasonForAuditOther ?? "",
        cqcRegulation: d.cqcRegulation ?? "",
        priorityType: (d.priorityType as WizardData["priorityType"]) ?? "",
        priorityTypeOther: d.priorityTypeOther ?? "",
        supportRequired: Array.isArray(d.supportRequired) ? d.supportRequired : [],
        supportRequiredOther: d.supportRequiredOther ?? "",
        auditStartDate: d.auditStartDate ? new Date(d.auditStartDate).toISOString().split("T")[0] : "",
        auditEndDate: d.auditEndDate ? new Date(d.auditEndDate).toISOString().split("T")[0] : "",
        auditObjectives: d.auditObjectives ?? "",
        whoInvolved: d.whoInvolved ?? "",
        auditStandards: Array.isArray(d.auditStandards) && d.auditStandards.length > 0
          ? d.auditStandards
          : [{ ...EMPTY_STANDARD }],
        evidenceBase: d.evidenceBase ?? "",
        stakeholders: d.stakeholders ?? "",
        stakeholdersInformed: d.stakeholdersInformed ?? false,
        dataSource: Array.isArray(d.dataSource) ? d.dataSource : [],
        dataSourceOther: d.dataSourceOther ?? "",
        dataCollectionMethodDetail: d.dataCollectionMethodDetail ?? "",
        dataCollectionTiming: (d.dataCollectionTiming as WizardData["dataCollectionTiming"]) ?? "",
        dataCollectedBy: d.dataCollectedBy ?? "",
        samplingMethodDetail: d.samplingMethodDetail ?? "",
        dataAnalysisDetail: d.dataAnalysisDetail ?? "",
        dataAnalysedBy: d.dataAnalysedBy ?? "",
        resultsPresentation: Array.isArray(d.resultsPresentation) ? d.resultsPresentation : [],
        resultsPresentationOther: d.resultsPresentationOther ?? "",
        actionPlanOwner: d.actionPlanOwner ?? "",
        barriersToChange: d.barriersToChange ?? "",
        reAuditTimeline: (d.reAuditTimeline as WizardData["reAuditTimeline"]) ?? "",
        reAuditTimelineOther: d.reAuditTimelineOther ?? "",
      });
    }
  }, [draftData, draftLoaded]);

  // Pre-fill auditor details from current user (only if not loading a draft)
  useEffect(() => {
    if (currentUser && !prefilled && !draftId) {
      setPrefilled(true);
      setData(p => ({ ...p, auditor: currentUser.fullName ?? "", email: currentUser.email ?? "", grade: currentUser.grade ?? "" }));
    }
  }, [currentUser, prefilled, draftId]);

  const onChange = (patch: Partial<WizardData>) => setData(p => ({ ...p, ...patch }));

  // ── Mutations ──────────────────────────────────────────────────────────────

  const submitMutation = trpc.audits.submit.useMutation({
    onSuccess: (res) => {
      setLastRef(res.refNumber);
      toast.success(`Audit submitted — ${res.refNumber}`);
      utils.audits.myDrafts.invalidate();
      utils.audits.mySubmissions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitDraftMutation = trpc.audits.submitDraft.useMutation({
    onSuccess: (res) => {
      setLastRef(res.refNumber);
      toast.success(`Audit submitted — ${res.refNumber}`);
      utils.audits.myDrafts.invalidate();
      utils.audits.mySubmissions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateDraftMutation = trpc.audits.updateDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft saved");
      utils.audits.myDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createDraftMutation = trpc.audits.submit.useMutation({
    onSuccess: (res) => {
      setDraftId((res.audit as { id: number }).id);
      toast.success("Draft saved");
      utils.audits.myDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Step 1 Validation ──────────────────────────────────────────────────────

  const validateStep1 = () => {
    const e: Partial<Record<string, string>> = {};
    if (!data.auditor.trim()) e.auditor = "Required";
    if (!data.grade) e.grade = "Required";
    if (!data.email.trim()) e.email = "Required";
    if (!data.category) e.category = "Required";
    if (!data.clinicalSetting) e.clinicalSetting = "Required";
    if (!data.priority) e.priority = "Required";
    if (!data.topic.trim() || data.topic.trim().length < 3) e.topic = "Please enter a title (min 3 characters)";
    if (!data.description.trim() || data.description.trim().length < 10) e.description = "Please enter a description (min 10 characters)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save Draft ─────────────────────────────────────────────────────────────

  const saveDraft = () => {
    if (draftId) {
      updateDraftMutation.mutate({
        auditId: draftId,
        ...buildStep2Payload(),
        topic: data.topic || undefined,
        category: data.category || undefined,
        clinicalSetting: data.clinicalSetting || undefined,
        priority: (["Routine", "Standard", "High", "Urgent"] as const).includes(data.priority as "Routine") ? data.priority as "Routine" : undefined,
        reaudit: data.reaudit || undefined,
        dataCollectionPeriod: data.dataCollectionPeriod || undefined,
        expectedSampleSize: data.expectedSampleSize || undefined,
        collaborators: data.collaborators,
        description: data.description || undefined,
        supervisorId: data.supervisorId,
      });
    } else {
      createDraftMutation.mutate({
        category: data.category || "General ENT",
        clinicalSetting: data.clinicalSetting || "Departmental",
        priority: (["Routine", "Standard", "High", "Urgent"] as const).includes(data.priority as "Routine") ? data.priority as "Routine" : "Routine",
        reaudit: data.reaudit || undefined,
        topic: data.topic || "Untitled Draft",
        dataCollectionPeriod: data.dataCollectionPeriod || undefined,
        expectedSampleSize: data.expectedSampleSize || undefined,
        collaborators: data.collaborators,
        description: data.description || "Draft — no description yet.",
        supervisorId: data.supervisorId ?? undefined,
        isDraft: true,
      });
    }
  };

  const buildStep2Payload = () => ({
    reasonForAudit: data.reasonForAudit,
    reasonForAuditOther: data.reasonForAuditOther || undefined,
    cqcRegulation: data.cqcRegulation || undefined,
    priorityType: data.priorityType || undefined,
    priorityTypeOther: data.priorityTypeOther || undefined,
    supportRequired: data.supportRequired,
    supportRequiredOther: data.supportRequiredOther || undefined,
    auditStartDate: data.auditStartDate ? new Date(data.auditStartDate) : undefined,
    auditEndDate: data.auditEndDate ? new Date(data.auditEndDate) : undefined,
    auditObjectives: data.auditObjectives || undefined,
    whoInvolved: data.whoInvolved || undefined,
    auditStandards: data.auditStandards.filter(s => s.standard),
    evidenceBase: data.evidenceBase || undefined,
    stakeholders: data.stakeholders || undefined,
    stakeholdersInformed: data.stakeholdersInformed,
    dataSource: data.dataSource,
    dataSourceOther: data.dataSourceOther || undefined,
    dataCollectionMethodDetail: data.dataCollectionMethodDetail || undefined,
    dataCollectionTiming: data.dataCollectionTiming || undefined,
    dataCollectedBy: data.dataCollectedBy || undefined,
    samplingMethodDetail: data.samplingMethodDetail || undefined,
    dataAnalysisDetail: data.dataAnalysisDetail || undefined,
    dataAnalysedBy: data.dataAnalysedBy || undefined,
    resultsPresentation: data.resultsPresentation,
    resultsPresentationOther: data.resultsPresentationOther || undefined,
    actionPlanOwner: data.actionPlanOwner || undefined,
    barriersToChange: data.barriersToChange || undefined,
    reAuditTimeline: data.reAuditTimeline || undefined,
    reAuditTimelineOther: data.reAuditTimelineOther || undefined,
  });

  // ── Final Submit ───────────────────────────────────────────────────────────

  const finalSubmit = () => {
    if (draftId) {
      // First save Step 2 data to draft, then submit
      updateDraftMutation.mutate(
        {
          auditId: draftId,
          ...buildStep2Payload(),
          topic: data.topic || undefined,
          category: data.category || undefined,
          clinicalSetting: data.clinicalSetting || undefined,
          priority: (["Routine", "Standard", "High", "Urgent"] as const).includes(data.priority as "Routine") ? data.priority as "Routine" : undefined,
          description: data.description || undefined,
          supervisorId: data.supervisorId,
        },
        {
          onSuccess: () => submitDraftMutation.mutate({ auditId: draftId }),
        }
      );
    } else {
      // No draft yet — use the original submit mutation
      const validPriorities = ["Routine", "Standard", "High", "Urgent"] as const;
      const priority = validPriorities.includes(data.priority as "Routine") ? data.priority as typeof validPriorities[number] : "Routine";
      submitMutation.mutate({
        category: data.category,
        clinicalSetting: data.clinicalSetting,
        priority,
        reaudit: data.reaudit || undefined,
        topic: data.topic,
        dataCollectionPeriod: data.dataCollectionPeriod || undefined,
        expectedSampleSize: data.expectedSampleSize || undefined,
        collaborators: data.collaborators,
        description: data.description,
        supervisorId: data.supervisorId ?? undefined,
      });
    }
  };

  const isBusy = submitMutation.isPending || submitDraftMutation.isPending || updateDraftMutation.isPending || createDraftMutation.isPending;

  // ── Success Screen ─────────────────────────────────────────────────────────

  if (lastRef) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          <h2 className="text-xl font-semibold">Audit Submitted Successfully</h2>
          <p className="text-sm text-muted-foreground">Your audit has been submitted for consultant review.</p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3">
            <p className="text-xs text-emerald-700">Reference number</p>
            <p className="text-lg font-mono font-bold text-emerald-800">{lastRef}</p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => { setLastRef(null); setData(EMPTY_WIZARD); setDraftId(null); setStep(1); }}>Submit Another</Button>
            <Button onClick={() => navigate("/check-status")}>Check Status</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Submit Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">Register a new clinical audit proposal.</p>
      </div>

      <StepIndicator step={step} />

      {step === 1 && <Step1 data={data} onChange={onChange} errors={errors} consultants={consultants} />}
      {step === 2 && <Step2 data={data} onChange={onChange} />}
      {step === 3 && <Step3 data={data} consultants={consultants} onEdit={(s) => setStep(s)} />}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={saveDraft} disabled={isBusy}>
            <Save className="w-4 h-4 mr-1" />Save as Draft
          </Button>
          {step < 3 && (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                setErrors({});
                setStep(s => (s + 1) as 2 | 3);
              }}
              disabled={isBusy}
            >
              {step === 2 ? "Review and Submit" : "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={finalSubmit} disabled={isBusy} className="px-6 bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4 mr-1" />{isBusy ? "Submitting..." : "Submit Now"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
