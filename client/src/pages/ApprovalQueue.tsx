// ApprovalQueue — Consultant view to approve/reject pending submissions
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, ClipboardCheck } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { format } from "date-fns";
import {
  getSubmissions,
  updateSubmission,
  createLog,
  type AppUser,
} from "@/lib/store";

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function ApprovalQueue({ user, onRefresh }: Props) {
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [rejectionErrors, setRejectionErrors] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const pending = getSubmissions().filter((s) => s.status === "pending");

  const isConsultant = user.role === "consultant" || user.role === "admin";

  const handleApprove = (id: string, ref: string) => {
    setProcessing(id);
    updateSubmission(id, {
      status: "approved",
      approved_by: user.full_name,
      approved_at: new Date().toISOString(),
    });
    createLog({
      submission_id: id,
      submission_ref: ref,
      event: "approved",
      actor: user.full_name,
      actor_email: user.email,
      note: "Approved via approval queue",
    });
    toast.success(`Audit ${ref} approved`);
    setProcessing(null);
    onRefresh();
  };

  const handleReject = (id: string, ref: string) => {
    const reason = rejectionReasons[id]?.trim();
    if (!reason) {
      setRejectionErrors((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setProcessing(id);
    updateSubmission(id, {
      status: "rejected",
      rejected_by: user.full_name,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    });
    createLog({
      submission_id: id,
      submission_ref: ref,
      event: "rejected",
      actor: user.full_name,
      actor_email: user.email,
      note: reason,
    });
    toast.success(`Audit ${ref} rejected`);
    setRejectionErrors((prev) => ({ ...prev, [id]: false }));
    setProcessing(null);
    onRefresh();
  };

  if (!isConsultant) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Consultant access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">Approval Queue</h2>
        <span className="text-sm text-muted-foreground">{pending.length} pending</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Review and action pending audit submissions.
      </p>

      {pending.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
          <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-1">No pending submissions to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((sub) => (
            <div key={sub.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="ref-mono text-xs text-muted-foreground">{sub.ref}</p>
                    <h3 className="text-sm font-semibold text-foreground mt-0.5">
                      {sub.topic || sub.type}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sub.auditor} · {sub.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <PriorityBadge priority={sub.priority} />
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px] border-b border-border bg-muted/20">
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground mt-0.5">{sub.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Setting</p>
                  <p className="font-medium text-foreground mt-0.5">{sub.setting}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="font-medium text-foreground mt-0.5">{sub.period || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium text-foreground mt-0.5">
                    {format(new Date(sub.created_date), "dd MMM yyyy")}
                  </p>
                </div>
              </div>

              {sub.description && (
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-[13px] text-foreground leading-relaxed">{sub.description}</p>
                </div>
              )}

              <div className="p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Rejection reason (required if rejecting)
                </p>
                <Textarea
                  value={rejectionReasons[sub.id] || ""}
                  onChange={(e) => {
                    setRejectionReasons((prev) => ({ ...prev, [sub.id]: e.target.value }));
                    if (rejectionErrors[sub.id])
                      setRejectionErrors((prev) => ({ ...prev, [sub.id]: false }));
                  }}
                  className={`text-[13px] min-h-[70px] mb-3 ${rejectionErrors[sub.id] ? "border-red-400" : ""}`}
                  placeholder="Provide a reason for rejection..."
                />
                {rejectionErrors[sub.id] && (
                  <p className="text-red-500 text-[11px] mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> A rejection reason is required.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleApprove(sub.id, sub.ref)}
                    disabled={processing === sub.id}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => handleReject(sub.id, sub.ref)}
                    disabled={processing === sub.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
