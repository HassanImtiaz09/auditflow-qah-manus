/**
 * ApprovalQueue — consultant view of their audit queue.
 * Supports approve, reject, and request-changes decisions.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ClipboardList, Inbox, Clock, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { formatDistanceToNow } from "date-fns";

type StatusFilter = "pending" | "approved" | "rejected" | "changes_requested" | "all";

const TABS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { value: "pending",           label: "Awaiting Review",    icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "changes_requested", label: "Changes Requested",  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: "approved",          label: "Approved",           icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { value: "rejected",          label: "Rejected",           icon: <XCircle className="w-3.5 h-3.5" /> },
  { value: "all",               label: "All",                icon: <History className="w-3.5 h-3.5" /> },
];

function getInitialTab(): StatusFilter {
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search).get("status");
    if (p === "approved" || p === "rejected" || p === "changes_requested" || p === "all") return p as StatusFilter;
  }
  return "pending";
}

export default function ApprovalQueue() {
  const utils = trpc.useUtils();
  const { data: queueData, isLoading } = trpc.audits.myConsultantQueue.useQuery();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<StatusFilter>(getInitialTab);

  // Sync tab to URL query param
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "pending") {
      url.searchParams.delete("status");
    } else {
      url.searchParams.set("status", activeTab);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  const decideMutation = trpc.audits.decide.useMutation({
    onSuccess: (_, vars) => {
      const msg =
        vars.decision === "approved" ? "Audit approved." :
        vars.decision === "rejected" ? "Audit rejected." :
        "Changes requested — the submitter has been notified.";
      toast.success(msg);
      utils.audits.myConsultantQueue.invalidate();
      utils.audits.myQueue.invalidate();
      utils.audits.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const decide = (auditId: number, decision: "approved" | "rejected" | "changes_requested") =>
    decideMutation.mutate({ auditId, decision, note: notes[auditId] });

  // Derive the list for the active tab
  const changesRequestedAudits = (queueData as any)?.changes_requested ?? [];
  const allAudits = [
    ...(queueData?.pending ?? []),
    ...(queueData?.approved ?? []),
    ...(queueData?.rejected ?? []),
    ...changesRequestedAudits,
  ];

  const visibleAudits =
    activeTab === "all"               ? allAudits :
    activeTab === "pending"           ? (queueData?.pending  ?? []) :
    activeTab === "approved"          ? (queueData?.approved ?? []) :
    activeTab === "rejected"          ? (queueData?.rejected ?? []) :
                                        changesRequestedAudits;

  // Tab counts
  const counts: Record<StatusFilter, number> = {
    pending:           queueData?.pending.length  ?? 0,
    approved:          queueData?.approved.length ?? 0,
    rejected:          queueData?.rejected.length ?? 0,
    changes_requested: changesRequestedAudits.length,
    all:               allAudits.length,
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending audit submissions and browse your decision history.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 mb-5 border border-border overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setExpanded(null); }}
              className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-background shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <span className={isActive
                ? tab.value === "pending"           ? "text-amber-600"
                  : tab.value === "approved"          ? "text-emerald-600"
                  : tab.value === "rejected"          ? "text-red-500"
                  : tab.value === "changes_requested" ? "text-orange-500"
                  : "text-foreground"
                : ""
              }>
                {tab.icon}
              </span>
              {tab.label}
              {counts[tab.value] > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                  isActive
                    ? tab.value === "pending"           ? "bg-amber-100 text-amber-700"
                      : tab.value === "approved"          ? "bg-emerald-100 text-emerald-700"
                      : tab.value === "rejected"          ? "bg-red-100 text-red-600"
                      : tab.value === "changes_requested" ? "bg-orange-100 text-orange-700"
                      : "bg-muted text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {counts[tab.value]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Audit list */}
      {visibleAudits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {activeTab === "pending"           ? "No pending audits" :
             activeTab === "approved"          ? "No approved audits yet" :
             activeTab === "rejected"          ? "No rejected audits yet" :
             activeTab === "changes_requested" ? "No audits with changes requested" :
             "No audits found"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === "pending"
              ? "All submissions have been reviewed."
              : "Decisions you make will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleAudits.map((audit: any) => {
            const isPending = audit.status === "pending";
            return (
              <div key={audit.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(expanded === audit.id ? null : audit.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        audit.status === "approved"          ? "bg-emerald-100" :
                        audit.status === "rejected"          ? "bg-red-100" :
                        audit.status === "changes_requested" ? "bg-orange-100" :
                        "bg-blue-100"
                      }`}>
                        <ClipboardList className={`w-4 h-4 ${
                          audit.status === "approved"          ? "text-emerald-600" :
                          audit.status === "rejected"          ? "text-red-500" :
                          audit.status === "changes_requested" ? "text-orange-500" :
                          "text-blue-600"
                        }`} />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{audit.refNumber}</p>
                        <p className="text-sm font-semibold mt-0.5">{audit.topic ?? audit.category}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          By {audit.submitterName} · {audit.submitterGrade}
                          {audit.submittedAt && (
                            <> · {formatDistanceToNow(new Date(audit.submittedAt), { addSuffix: true })}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={audit.priority} />
                      <StatusBadge status={audit.status} />
                    </div>
                  </div>
                </div>

                {expanded === audit.id && (
                  <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-xs text-muted-foreground">Category</span><p className="font-medium">{audit.category}</p></div>
                      <div><span className="text-xs text-muted-foreground">Setting</span><p className="font-medium">{audit.clinicalSetting}</p></div>
                      {audit.topic && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Topic</span><p className="font-medium">{audit.topic}</p></div>
                      )}
                      {audit.supervisorName && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Supervisor</span><p className="font-medium">{audit.supervisorName}</p></div>
                      )}
                      <div className="col-span-2"><span className="text-xs text-muted-foreground">Description</span><p className="mt-1 leading-relaxed">{audit.description}</p></div>
                      {audit.auditObjectives && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Audit Objectives</span><p className="mt-1 leading-relaxed">{audit.auditObjectives}</p></div>
                      )}
                      {audit.dataCollectionMethodDetail && (
                        <div className="col-span-2"><span className="text-xs text-muted-foreground">Data Collection Method</span><p className="mt-1 leading-relaxed">{audit.dataCollectionMethodDetail}</p></div>
                      )}
                    </div>

                    {/* Decision note (read-only for decided audits) */}
                    {!isPending && audit.decisionNote && (
                      <div className={`p-3 rounded-lg text-sm ${
                        audit.status === "approved"          ? "bg-emerald-50 border border-emerald-200 text-emerald-800" :
                        audit.status === "changes_requested" ? "bg-orange-50 border border-orange-200 text-orange-800" :
                        "bg-red-50 border border-red-200 text-red-800"
                      }`}>
                        <p className="text-xs font-semibold mb-1">
                          {audit.status === "changes_requested" ? "Changes Requested" : "Decision Note"}
                        </p>
                        <p>{audit.decisionNote}</p>
                      </div>
                    )}

                    {/* Action buttons — only for pending audits */}
                    {isPending && (
                      <>
                        <div>
                          <label className="text-xs font-medium">Decision Note (optional)</label>
                          <Textarea
                            value={notes[audit.id] ?? ""}
                            onChange={e => setNotes(p => ({ ...p, [audit.id]: e.target.value }))}
                            placeholder="Add a note for the submitter…"
                            className="mt-1 text-sm min-h-[80px]"
                          />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            onClick={() => decide(audit.id, "approved")}
                            disabled={decideMutation.isPending}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />Approve
                          </Button>
                          <Button
                            onClick={() => decide(audit.id, "changes_requested")}
                            disabled={decideMutation.isPending}
                            variant="outline"
                            className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 min-w-[140px]"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />Request Changes
                          </Button>
                          <Button
                            onClick={() => decide(audit.id, "rejected")}
                            disabled={decideMutation.isPending}
                            variant="destructive"
                            className="flex-1 min-w-[100px]"
                          >
                            <XCircle className="w-4 h-4 mr-2" />Reject
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
