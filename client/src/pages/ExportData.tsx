// ExportData — admin-only export page
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ExportData() {
  const { data: currentUser, isLoading: userLoading } = trpc.auth.currentUser.useQuery();
  const isAdmin = currentUser?.auditRole === "admin";

  // Only fetch audit data when the user is confirmed to be an admin
  const { data: audits = [], isLoading: auditsLoading } = trpc.audits.list.useQuery(
    undefined,
    { enabled: isAdmin }
  );
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const isLoading = userLoading || auditsLoading;

  // Show loading state while resolving user role
  if (userLoading) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  // Non-admin: show a clear "Not authorised" notice
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Export Data</h1>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-sm">Not Authorised</p>
            <p className="text-sm text-muted-foreground mt-1">
              Data export is restricted to administrators. Please contact your audit lead if you need a copy of the registry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const years = Array.from(new Set(
    audits
      .filter(a => a.submittedAt)
      .map(a => new Date(a.submittedAt!).getFullYear().toString())
  )).sort().reverse();

  const filtered = audits.filter(a => {
    if (yearFilter !== "all" && a.submittedAt) {
      if (new Date(a.submittedAt).getFullYear().toString() !== yearFilter) return false;
    }
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const exportCsv = (rows: typeof audits, filename: string) => {
    const headers = ["Reference","Status","Submitter","Grade","Email","Category","Setting","Priority","Topic","Period","Sample","Re-audit","Description","Submitted At","Decided At","Decision Note"];
    const lines = [headers.join(",")];
    rows.forEach(r => {
      const values = [
        r.refNumber, r.status, r.submitterName ?? "", r.submitterGrade ?? "", r.submitterEmail ?? "",
        r.category ?? "", r.clinicalSetting, r.priority, r.topic ?? "", r.dataCollectionPeriod ?? "",
        r.expectedSampleSize ?? "", r.reaudit ?? "No",
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
        r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "",
        r.decidedAt ? new Date(r.decidedAt).toLocaleDateString() : "",
        `"${(r.decisionNote ?? "").replace(/"/g, '""')}"`,
      ];
      lines.push(values.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = filename; el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Export Data</h1>
        <p className="text-sm text-muted-foreground mt-1">Download audit registry data as CSV for reporting.</p>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Filter by Year</label>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            {isLoading ? "Loading…" : `${filtered.length} records selected`}
          </div>
          <Button
            onClick={() => exportCsv(filtered, `audits-${yearFilter}-${statusFilter}.csv`)}
            disabled={isLoading || filtered.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>
      <div className="mt-4 bg-card rounded-xl border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold mb-3">Quick Exports</h3>
        <div className="space-y-2">
          {[
            { label: "All Approved Audits", status: "approved" },
            { label: "All Pending Audits",  status: "pending" },
            { label: "All Rejected Audits", status: "rejected" },
            { label: "Full Registry",       status: "all" },
          ].map(q => {
            const rows = q.status === "all" ? audits : audits.filter(a => a.status === q.status);
            return (
              <div key={q.status} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{q.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{rows.length} records</span>
                  <Button variant="outline" size="sm" onClick={() => exportCsv(rows, `audits-${q.status}.csv`)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />Download
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
