// SubmitAudit — Multi-Step Clinical Audit Registration Wizard
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Save, Send, Plus, X, ChevronRight, ChevronLeft, CheckCircle2, Trash2, FileText, ChevronsUpDown, Check, BookOpen } from "lucide-react";
import { AUDIT_CATEGORIES, CLINICAL_SETTINGS, PRIORITIES, GRADES, REAUDIT_OPTIONS } from "@/lib/auditConstants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  // Re-audit linking
  linkedAuditId: number | null;
  linkedAuditRef: string;
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
  linkedAuditId: null, linkedAuditRef: "",
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
  const [reauditSearch, setReauditSearch] = useState(data.linkedAuditRef || "");
  const [reauditOpen, setReauditOpen] = useState(false);
  const { data: reauditResults = [] } = trpc.audits.searchByRef.useQuery(
    { query: reauditSearch },
    { enabled: reauditSearch.length >= 2 }
  );
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
            <Select value={data.reaudit} onValueChange={v => {
              onChange({ reaudit: v });
              if (v !== "Yes") onChange({ linkedAuditId: null, linkedAuditRef: "" });
            }}>
              <SelectTrigger className="mt-1 text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>{REAUDIT_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {data.reaudit === "Yes" && (
            <div className="md:col-span-2">
              <Label className="text-xs">Link to Previous Audit</Label>
              <p className="text-[11px] text-muted-foreground mb-1">Search by reference number or title to link this re-audit to its predecessor.</p>
              {data.linkedAuditRef ? (
                <div className="flex items-center gap-2 mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs font-mono text-blue-700">{data.linkedAuditRef}</span>
                  <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => { onChange({ linkedAuditId: null, linkedAuditRef: "" }); setReauditSearch(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Popover open={reauditOpen} onOpenChange={setReauditOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="mt-1 w-full justify-start text-muted-foreground">
                      <ChevronsUpDown className="w-3.5 h-3.5 mr-2" />Search previous audits...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Type ref number or title..."
                        value={reauditSearch}
                        onValueChange={setReauditSearch}
                      />
                      <CommandList>
                        <CommandEmpty>{reauditSearch.length < 2 ? "Type at least 2 characters" : "No audits found"}</CommandEmpty>
                        <CommandGroup heading="Matching audits">
                          {reauditResults.map(r => (
                            <CommandItem
                              key={r.id}
                              value={r.refNumber + " " + r.topic}
                              onSelect={() => {
                                onChange({ linkedAuditId: r.id, linkedAuditRef: r.refNumber ?? r.topic });
                                setReauditOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{r.refNumber}</span>
                                <span className="text-[11px] text-muted-foreground">{r.topic}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
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

function Step2({ data, onChange, specialty, errors = {} }: { data: WizardData; onChange: (patch: Partial<WizardData>) => void; specialty: string; errors?: Partial<Record<string, string>> }) {
  const [presetOpen, setPresetOpen] = useState(false);
  const { data: presets = [] } = trpc.audits.standardPresets.useQuery(
    { specialty },
    { enabled: !!specialty }
  );

  const applyPreset = (preset: { standard: string; criteria: string; compliance: string; exceptions: string }) => {
    // Replace the last empty row or append
    const existing = data.auditStandards;
    const emptyIdx = existing.findIndex(r => !r.standard && !r.criteria);
    if (emptyIdx >= 0) {
      const updated = existing.map((r, i) => i === emptyIdx ? { ...preset } : r);
      onChange({ auditStandards: updated });
    } else {
      onChange({ auditStandards: [...existing, { ...preset }] });
    }
    setPresetOpen(false);
  };

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
        <div {...(errors.auditObjectives ? { "data-error-field": "auditObjectives" } : {})}>
          <Label className="text-xs">Audit Objectives <span className="text-red-500">*</span></Label>
          <Textarea
            value={data.auditObjectives}
            onChange={e => onChange({ auditObjectives: e.target.value })}
            className={`mt-1 text-[13px] min-h-[80px]${errors.auditObjectives ? " border-red-400 ring-1 ring-red-400" : ""}`}
            placeholder="What outcomes does this audit aim to achieve?"
            aria-invalid={!!errors.auditObjectives}
          />
          {errors.auditObjectives && <p className="mt-1 text-xs text-red-600">{errors.auditObjectives}</p>}
        </div>
        <div className="mt-4">
          <Label className="text-xs">Who Will Be Involved and Their Role</Label>
          <Textarea value={data.whoInvolved} onChange={e => onChange({ whoInvolved: e.target.value })} className="mt-1 text-[13px] min-h-[60px]" placeholder="e.g. Lead auditor, data collector, supervisor..." />
        </div>
      </div>

      {/* Audit Standards */}
      <div
        className={`bg-card rounded-xl border p-6 shadow-sm${errors.auditStandards ? " border-red-400" : " border-border"}`}
        {...(errors.auditStandards ? { "data-error-field": "auditStandards" } : {})}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Audit Standards <span className="text-red-500">*</span></h3>
            {errors.auditStandards && <p className="text-xs text-red-600 mt-0.5">{errors.auditStandards}</p>}
          </div>
          <div className="flex gap-2">
            {presets.length > 0 && (
              <Popover open={presetOpen} onOpenChange={setPresetOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <BookOpen className="w-3.5 h-3.5 mr-1" />Load Preset
                    <ChevronsUpDown className="w-3 h-3 ml-1 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search standards..." />
                    <CommandList>
                      <CommandEmpty>No matching standards.</CommandEmpty>
                      <CommandGroup heading={`${specialty} presets`}>
                        {presets.map((p, idx) => (
                          <CommandItem
                            key={idx}
                            value={p.standard + " " + p.criteria}
                            onSelect={() => applyPreset(p)}
                            className="flex-col items-start py-2"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Check className="w-3.5 h-3.5 opacity-0" />
                              <span className="font-medium text-xs">{p.standard}</span>
                              {p.compliance && <span className="ml-auto text-[11px] text-blue-600">{p.compliance}</span>}
                            </div>
                            {p.criteria && <p className="text-[11px] text-muted-foreground ml-5 mt-0.5 line-clamp-2">{p.criteria}</p>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addStandard}><Plus className="w-3.5 h-3.5 mr-1" />Add Row</Button>
          </div>
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
        <div
          className="mt-4"
          {...(errors.dataCollectionMethodDetail ? { "data-error-field": "dataCollectionMethodDetail" } : {})}
        >
          <Label className="text-xs">Data Collection Method <span className="text-red-500">*</span></Label>
          <Textarea
            value={data.dataCollectionMethodDetail}
            onChange={e => onChange({ dataCollectionMethodDetail: e.target.value })}
            className={`mt-1 text-[13px] min-h-[60px]${errors.dataCollectionMethodDetail ? " border-red-400 ring-1 ring-red-400" : ""}`}
            placeholder="Describe how data will be collected..."
            aria-invalid={!!errors.dataCollectionMethodDetail}
          />
          {errors.dataCollectionMethodDetail && <p className="mt-1 text-xs text-red-600">{errors.dataCollectionMethodDetail}</p>}
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

  const downloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    // Header
    doc.setFillColor(0, 51, 102);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Queen Alexandra Hospital — Clinical Audit Registration Form", margin, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, pageW - margin, 14, { align: "right" });
    y = 30;

    const section = (title: string) => {
      doc.setFillColor(230, 237, 248);
      doc.rect(margin, y, pageW - margin * 2, 7, "F");
      doc.setTextColor(0, 51, 102);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 2, y + 5);
      y += 10;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
    };

    const field = (label: string, value: string) => {
      if (!value) return;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value, pageW - margin * 2 - 40);
      doc.text(lines, margin + 40, y);
      y += Math.max(5, lines.length * 4.5);
      if (y > 270) { doc.addPage(); y = 14; }
    };

    section("1. Auditor Details");
    field("Auditor Name", data.auditor);
    field("Grade", data.grade);
    field("Email", data.email);
    field("Supervising Consultant", supervisor ? supervisor.fullName : "Not assigned");

    section("2. Audit Details");
    field("Audit Title", data.topic);
    field("Category", data.category);
    field("Clinical Setting", data.clinicalSetting);
    field("Priority", data.priority);
    field("Re-audit", data.reaudit);
    if (data.linkedAuditRef) field("Linked Previous Audit", data.linkedAuditRef);
    field("Data Collection Period", data.dataCollectionPeriod);
    field("Expected Sample Size", data.expectedSampleSize);
    field("Collaborators", data.collaborators.join(", "));
    field("Description", data.description);

    section("3. Reason for Audit");
    field("Reasons", [...data.reasonForAudit, ...(data.reasonForAuditOther ? [data.reasonForAuditOther] : [])].join(", "));
    field("CQC Regulation", data.cqcRegulation);
    field("Priority Classification", data.priorityType);
    field("Support Required", [...data.supportRequired, ...(data.supportRequiredOther ? [data.supportRequiredOther] : [])].join(", "));

    section("4. Timeline & Objectives");
    field("Start Date", data.auditStartDate);
    field("End Date", data.auditEndDate);
    field("Objectives", data.auditObjectives);
    field("Who Involved", data.whoInvolved);

    // Audit Standards table
    const standards = data.auditStandards.filter(s => s.standard);
    if (standards.length > 0) {
      section("5. Audit Standards");
      autoTable(doc, {
        startY: y,
        head: [["Standard", "Criteria", "Target %", "Exceptions"]],
        body: standards.map(s => [s.standard, s.criteria, s.compliance, s.exceptions]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [0, 51, 102] },
        margin: { left: margin, right: margin },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    } else {
      section("5. Audit Standards");
      field("Standards", "None entered");
    }

    field("Evidence Base", data.evidenceBase);

    section("6. Stakeholders");
    field("Stakeholders", data.stakeholders);
    field("Stakeholders Informed", data.stakeholdersInformed ? "Yes" : "No");

    section("7. Data Collection");
    field("Data Source", [...data.dataSource, ...(data.dataSourceOther ? [data.dataSourceOther] : [])].join(", "));
    field("Collection Method", data.dataCollectionMethodDetail);
    field("Collection Timing", data.dataCollectionTiming);
    field("Data Collected By", data.dataCollectedBy);
    field("Sampling Method", data.samplingMethodDetail);

    section("8. Data Analysis");
    field("Analysis Description", data.dataAnalysisDetail);
    field("Data Analysed By", data.dataAnalysedBy);

    section("9. Results & Action Plan");
    field("Results Presented To", [...data.resultsPresentation, ...(data.resultsPresentationOther ? [data.resultsPresentationOther] : [])].join(", "));
    field("Action Plan Owner", data.actionPlanOwner);
    field("Barriers to Change", data.barriersToChange);
    field("Re-audit Timeline", data.reAuditTimeline === "other" ? data.reAuditTimelineOther : data.reAuditTimeline);

    // Signature block
    if (y > 240) { doc.addPage(); y = 14; }
    y += 8;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, margin + 60, y);
    doc.line(margin + 80, y, margin + 140, y);
    doc.setFontSize(7);
    doc.text("Auditor Signature", margin, y + 4);
    doc.text("Supervisor Signature", margin + 80, y + 4);
    doc.text("Date: ________________", margin + 150, y + 4);

    const filename = `audit-registration-${data.topic.replace(/\s+/g, "-").toLowerCase() || "draft"}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-amber-800">Please review all details carefully before submitting. Once submitted, the audit will be sent for consultant approval.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={downloadPDF} className="shrink-0 text-xs">
          <FileText className="w-3.5 h-3.5 mr-1" />Download Form
        </Button>
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Ref for auto-save debounce timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to the first error element for auto-scroll
  const firstErrorRef = useRef<HTMLDivElement | null>(null);

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
        linkedAuditId: d.linkedAuditId ?? null,
        linkedAuditRef: d.linkedAuditRef ?? "",
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

  // ── Auto-save (silent, debounced 30 s) ────────────────────────────────────
  // saveDraftSilent: same logic as saveDraft but shows auto-save status, not a toast
  const saveDraftSilentRef = useRef<(() => void) | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const submitMutation = trpc.audits.submit.useMutation({
    onSuccess: (res) => {
      setLastRef(res.refNumber);
      toast.success(`Audit submitted — ${res.refNumber}`);
      utils.audits.myDrafts.invalidate();
      utils.audits.mySubmissions.invalidate();
    },
    onError: (err) => {
      setSubmitError(err.message);
      toast.error(err.message);
    },
  });

  const submitDraftMutation = trpc.audits.submitDraft.useMutation({
    onSuccess: (res) => {
      setLastRef(res.refNumber);
      toast.success(`Audit submitted — ${res.refNumber}`);
      utils.audits.myDrafts.invalidate();
      utils.audits.mySubmissions.invalidate();
    },
    onError: (err) => {
      setSubmitError(err.message);
      toast.error(err.message);
    },
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

  // Silent variants for auto-save (no toast, just status indicator)
  const autoSaveUpdateMutation = trpc.audits.updateDraft.useMutation({
    onSuccess: () => {
      setAutoSaveStatus("saved");
      utils.audits.myDrafts.invalidate();
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    },
    onError: () => setAutoSaveStatus("idle"),
  });

  // Ref so autoSaveCreateMutation's onSuccess can call the update mutation with the latest data
  const autoSaveStep2PayloadRef = useRef<ReturnType<typeof buildStep2Payload> | null>(null);

  const autoSaveCreateMutation = trpc.audits.submit.useMutation({
    onSuccess: (res) => {
      const newId = (res.audit as { id: number }).id;
      setDraftId(newId);
      // Immediately follow up with a full Step 2 update so no data is lost
      if (autoSaveStep2PayloadRef.current) {
        autoSaveUpdateMutation.mutate({
          auditId: newId,
          ...autoSaveStep2PayloadRef.current,
        });
      } else {
        setAutoSaveStatus("saved");
        utils.audits.myDrafts.invalidate();
        setTimeout(() => setAutoSaveStatus("idle"), 3000);
      }
    },
    onError: () => setAutoSaveStatus("idle"),
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

  // Silent auto-save (no toast)
  const saveDraftSilent = useCallback(() => {
    const draftIdSnapshot = draftId;
    if (draftIdSnapshot) {
      setAutoSaveStatus("saving");
      autoSaveUpdateMutation.mutate({
        auditId: draftIdSnapshot,
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
    } else if (data.topic.trim().length >= 3) {
      // Only create a new draft silently if there's enough content
      setAutoSaveStatus("saving");
      // Capture the current Step 2 payload so the create onSuccess can immediately update
      autoSaveStep2PayloadRef.current = buildStep2Payload();
      autoSaveCreateMutation.mutate({
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, data, autoSaveUpdateMutation, autoSaveCreateMutation]);

  // Keep a stable ref so the debounce timer can call the latest version
  saveDraftSilentRef.current = saveDraftSilent;

  // Debounced auto-save: reset 30 s timer on every data change (skip initial mount and draft loading)
  const dataInitialized = useRef(false);
  useEffect(() => {
    if (!dataInitialized.current) {
      dataInitialized.current = true;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraftSilentRef.current?.();
    }, 30_000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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

  const validateStep2 = () => {
    const e: Partial<Record<string, string>> = {};
    if (!data.auditObjectives.trim()) e.auditObjectives = "Required — please describe the objectives of this audit";
    const hasStandards = data.auditStandards.some(s => s.standard && s.standard.trim().length > 0);
    if (!hasStandards) e.auditStandards = "Required — please add at least one audit standard";
    if (!data.dataCollectionMethodDetail.trim()) e.dataCollectionMethodDetail = "Required — please describe the data collection method";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Scroll to first error after React re-renders the error messages
      requestAnimationFrame(() => {
        const firstError = document.querySelector<HTMLElement>("[data-error-field]");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
          // Focus the field if it's focusable
          const focusable = firstError.querySelector<HTMLElement>("textarea, input");
          focusable?.focus({ preventScroll: true });
        }
      });
    }
    return Object.keys(e).length === 0;
  };

  const finalSubmit = () => {
    setSubmitError(null);
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
        // Step 2 fields
        auditObjectives: data.auditObjectives || undefined,
        auditStandards: data.auditStandards ? JSON.stringify(data.auditStandards) : undefined,
        dataCollectionMethodDetail: data.dataCollectionMethodDetail || undefined,
      });
    }
  };

  const isBusy = submitMutation.isPending || submitDraftMutation.isPending || updateDraftMutation.isPending || createDraftMutation.isPending || autoSaveUpdateMutation.isPending || autoSaveCreateMutation.isPending;

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

      {/* Step 2 progress indicator */}
      {step === 2 && (() => {
        const requiredFields = [
          { key: "auditObjectives", label: "Audit Objectives", filled: data.auditObjectives.trim().length > 0 },
          { key: "auditStandards", label: "Audit Standards", filled: data.auditStandards.some(s => s.standard.trim().length > 0) },
          { key: "dataCollectionMethodDetail", label: "Data Collection Method", filled: data.dataCollectionMethodDetail.trim().length > 0 },
        ];
        const filledCount = requiredFields.filter(f => f.filled).length;
        const total = requiredFields.length;
        const allDone = filledCount === total;
        return (
          <div className={`mb-4 flex items-center gap-3 rounded-lg px-4 py-2.5 text-xs border ${
            allDone ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex gap-1.5 items-center">
              {requiredFields.map(f => (
                <div
                  key={f.key}
                  title={f.label}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    f.filled ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
              ))}
            </div>
            <span className="font-medium">
              {filledCount} of {total} required fields filled
            </span>
            {!allDone && (
              <span className="text-amber-700">
                — complete {requiredFields.filter(f => !f.filled).map(f => f.label).join(", ")} to continue
              </span>
            )}
            {allDone && <span className="text-emerald-700">— ready to review</span>}
          </div>
        );
      })()}

      {step === 1 && <Step1 data={data} onChange={onChange} errors={errors} consultants={consultants} />}
      {step === 2 && (
        <Step2
          data={data}
          onChange={onChange}
          errors={errors}
          specialty={(() => {
            const sup = consultants.find(c => c.id === data.supervisorId);
            if (sup) return sup.grade.replace(/^Consultant\s*[\u2014\-]\s*/i, "").trim();
            return data.category || "";
          })()}
        />
      )}
      {step === 3 && (
        <>
          {submitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
              <div className="shrink-0 mt-0.5 text-red-500">⚠</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Submission blocked</p>
                <p className="text-xs text-red-700 mt-0.5">{submitError}</p>
              </div>
              <button
                type="button"
                className="text-xs text-red-600 underline shrink-0"
                onClick={() => { setSubmitError(null); setStep(2); }}
              >Go back to fix</button>
            </div>
          )}
          <Step3 data={data} consultants={consultants} onEdit={(s) => { setSubmitError(null); setStep(s); }} />
        </>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
          )}
          {/* Auto-save status */}
          {autoSaveStatus === "saving" && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />Saved automatically
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={saveDraft} disabled={isBusy}>
            <Save className="w-4 h-4 mr-1" />Save
          </Button>
          {step < 3 && (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                setErrors({});
                setSubmitError(null);
                setStep(s => (s + 1) as 2 | 3);
              }}
              disabled={isBusy}
            >
              {step === 2 ? "Review and Submit" : "Next Page: Details"}
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
