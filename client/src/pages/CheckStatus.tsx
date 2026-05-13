// CheckStatus — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";

export default function CheckStatus() {
  const [refInput, setRefInput] = useState("");
  const [searchRef, setSearchRef] = useState<string | null>(null);
  const { data: audit, isLoading, error } = trpc.audits.byRef.useQuery(
    { ref: searchRef! },
    { enabled: !!searchRef }
  );

  const handleSearch = () => {
    const trimmed = refInput.trim().toUpperCase();
    if (!trimmed) return;
    setSearchRef(trimmed);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Check Status</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Enter your audit reference number to view its current status.
      </p>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-5">
        <Label className="text-xs font-medium">Reference Number</Label>
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

      {isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}

      {error && (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No submission found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Check the reference number and try again.
          </p>
        </div>
      )}

      {audit && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{audit.refNumber}</p>
              <h3 className="text-sm font-semibold text-foreground mt-1">
                {audit.topic || audit.category}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{audit.category}</p>
            </div>
            <StatusBadge status={audit.status} />
          </div>

          <div className="p-5 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <p className="text-xs text-muted-foreground">Auditor</p>
              <p className="font-medium text-foreground mt-0.5">{audit.submitterName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="font-medium text-foreground mt-0.5">{audit.submitterGrade ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Priority</p>
              <div className="mt-0.5"><PriorityBadge priority={audit.priority} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Setting</p>
              <p className="font-medium text-foreground mt-0.5">{audit.clinicalSetting}</p>
            </div>
            {audit.supervisorName && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Supervising Consultant</p>
                <p className="font-medium text-foreground mt-0.5">{audit.supervisorName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="font-medium text-foreground mt-0.5">
                {audit.submittedAt ? format(new Date(audit.submittedAt), "dd MMM yyyy") : "—"}
              </p>
            </div>
          </div>

          {audit.description && (
            <div className="px-5 pb-4">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-[13px] text-foreground mt-1 leading-relaxed">{audit.description}</p>
            </div>
          )}

          {audit.status === "pending" && (
            <div className="mx-5 mb-5 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Your submission is awaiting consultant review.
              </p>
            </div>
          )}

          {audit.status === "approved" && (
            <div className="mx-5 mb-5 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-800 font-medium">Approved</p>
                {audit.decisionNote && (
                  <p className="text-xs text-emerald-700 mt-0.5">{audit.decisionNote}</p>
                )}
              </div>
            </div>
          )}

          {audit.status === "rejected" && (
            <div className="mx-5 mb-5 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-red-800 font-medium">Rejected</p>
                {audit.decisionNote && (
                  <p className="text-xs text-red-700 mt-0.5">{audit.decisionNote}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
