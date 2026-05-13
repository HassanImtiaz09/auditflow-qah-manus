// CheckStatus — Search by reference number to view audit status
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Clock, CheckCircle2, XCircle, Trash2, FileText } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { format } from "date-fns";
import {
  getSubmissions,
  deleteSubmission,
  type AuditSubmission,
  type AppUser,
} from "@/lib/store";

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function CheckStatus({ user, onRefresh }: Props) {
  const [refInput, setRefInput] = useState("");
  const [result, setResult] = useState<AuditSubmission | null | "not_found">(null);

  const handleSearch = () => {
    const trimmed = refInput.trim().toUpperCase();
    if (!trimmed) return;
    const submissions = getSubmissions();
    const found = submissions.find(
      (s) => s.ref.toUpperCase() === trimmed || s.serial?.toUpperCase() === trimmed
    );
    setResult(found ?? "not_found");
  };

  const handleDelete = (id: string) => {
    deleteSubmission(id);
    toast.success("Submission deleted");
    setResult(null);
    setRefInput("");
    onRefresh();
  };

  const canDelete = (sub: AuditSubmission) =>
    user.role === "admin" || (sub.email === user.email && sub.status === "draft");

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Check Status</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Enter your audit reference or serial number to view its current status.
      </p>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-5">
        <Label className="text-xs font-medium">Reference / Serial Number</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            className="text-[13px] font-mono"
            placeholder="e.g. REF-20250310-0001"
          />
          <Button onClick={handleSearch} className="shrink-0">
            <Search className="w-4 h-4 mr-1" />
            Search
          </Button>
        </div>
      </div>

      {result === "not_found" && (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No submission found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Check the reference number and try again.
          </p>
        </div>
      )}

      {result && result !== "not_found" && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex items-start justify-between gap-4">
            <div>
              <p className="ref-mono text-xs text-muted-foreground">{result.ref}</p>
              {result.serial && (
                <p className="ref-mono text-xs text-muted-foreground mt-0.5">{result.serial}</p>
              )}
              <h3 className="text-sm font-semibold text-foreground mt-1">
                {result.topic || result.type}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={result.status} />
              {canDelete(result) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(result.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="p-5 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-xs text-muted-foreground">Auditor</p>
              <p className="font-medium text-foreground mt-0.5">{result.auditor}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="font-medium text-foreground mt-0.5">{result.grade}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium text-foreground mt-0.5">{result.type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Priority</p>
              <div className="mt-0.5"><PriorityBadge priority={result.priority} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Setting</p>
              <p className="font-medium text-foreground mt-0.5">{result.setting}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="font-medium text-foreground mt-0.5">
                {format(new Date(result.created_date), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          {result.description && (
            <div className="px-5 pb-4">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-[13px] text-foreground mt-1 leading-relaxed">{result.description}</p>
            </div>
          )}

          {/* Status-specific info */}
          {result.status === "pending" && (
            <div className="mx-5 mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Your submission is awaiting consultant review. You will be notified once a decision is made.
              </p>
            </div>
          )}

          {result.status === "approved" && (
            <div className="mx-5 mb-5 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-800 font-medium">Approved</p>
                {result.approved_by && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    By {result.approved_by}
                    {result.approved_at && ` on ${format(new Date(result.approved_at), "dd MMM yyyy")}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {result.status === "rejected" && (
            <div className="mx-5 mb-5 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-800 font-medium">Rejected</p>
                {result.rejection_reason && (
                  <p className="text-xs text-red-700 mt-0.5">{result.rejection_reason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
