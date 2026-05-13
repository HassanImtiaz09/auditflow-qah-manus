// ApprovalQueue — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ClipboardList, Inbox } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";

export default function ApprovalQueue() {
  const utils = trpc.useUtils();
  const { data: audits = [], isLoading } = trpc.audits.myQueue.useQuery();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const decideMutation = trpc.audits.decide.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approved" ? "Audit approved." : "Audit rejected.");
      utils.audits.myQueue.invalidate();
      utils.audits.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const decide = (auditId: number, decision: "approved" | "rejected") =>
    decideMutation.mutate({ auditId, decision, note: notes[auditId] });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Review and decide on pending audit submissions assigned to you.</p>
      </div>
      {audits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No pending audits</p>
          <p className="text-xs text-muted-foreground mt-1">All submissions have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {audits.map(audit => (
            <div key={audit.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(expanded === audit.id ? null : audit.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{audit.refNumber}</p>
                      <p className="text-sm font-semibold mt-0.5">{audit.category}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">By {audit.submitterName} · {audit.submitterGrade}</p>
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
                    <div><span className="text-xs text-muted-foreground">Setting</span><p className="font-medium">{audit.clinicalSetting}</p></div>
                    <div><span className="text-xs text-muted-foreground">Topic</span><p className="font-medium">{audit.topic || "—"}</p></div>
                    {audit.supervisorName && (
                      <div className="col-span-2"><span className="text-xs text-muted-foreground">Supervisor</span><p className="font-medium">{audit.supervisorName}</p></div>
                    )}
                    <div className="col-span-2"><span className="text-xs text-muted-foreground">Description</span><p className="mt-1 leading-relaxed">{audit.description}</p></div>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Decision Note (optional)</label>
                    <Textarea
                      value={notes[audit.id] ?? ""}
                      onChange={e => setNotes(p => ({ ...p, [audit.id]: e.target.value }))}
                      placeholder="Add a note for the submitter…"
                      className="mt-1 text-sm min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => decide(audit.id, "approved")}
                      disabled={decideMutation.isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />Approve
                    </Button>
                    <Button
                      onClick={() => decide(audit.id, "rejected")}
                      disabled={decideMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
