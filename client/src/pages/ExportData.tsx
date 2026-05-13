// ExportData — CSV export by year or quick export by status
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText } from "lucide-react";
import { getSubmissions, type AuditSubmission } from "@/lib/store";

function toCSV(rows: AuditSubmission[]): string {
  if (rows.length === 0) return "";
  const headers = [
    "Reference","Serial","Status","Auditor","Grade","Email","Category",
    "Setting","Priority","Topic","Period","Sample","Re-audit","Description",
    "Approved By","Approved At","Rejected By","Rejected At","Rejection Reason","Submitted At",
  ];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const values = [
      r.ref, r.serial || "", r.status, r.auditor, r.grade, r.email, r.type,
      r.setting, r.priority, r.topic || "", r.period || "", r.sample || "",
      r.reaudit || "No", `"${(r.description || "").replace(/"/g, '""')}"`,
      r.approved_by || "", r.approved_at || "", r.rejected_by || "",
      r.rejected_at || "", `"${(r.rejection_reason || "").replace(/"/g, '""')}"`,
      r.created_date || "",
    ];
    lines.push(values.join(","));
  });
  return lines.join("\n");
}

function downloadCSV(data: AuditSubmission[], filename: string) {
  const csv = toCSV(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportData() {
  const submissions = getSubmissions();
  const years = useMemo(() => {
    const ys = new Set(submissions.map((s) => new Date(s.created_date).getFullYear()));
    return Array.from(ys).sort((a, b) => b - a);
  }, [submissions]);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [yearType, setYearType] = useState("all");

  const yearlyData = useMemo(() => {
    return submissions.filter((s) => {
      const y = new Date(s.created_date).getFullYear();
      if (String(y) !== year) return false;
      if (yearType !== "all" && s.status !== yearType) return false;
      return true;
    });
  }, [submissions, year, yearType]);

  const approvedOnly = submissions.filter((s) => s.status === "approved");
  const pendingOnly  = submissions.filter((s) => s.status === "pending");

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Export Data</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Download audit records as CSV for reporting or analysis.
      </p>

      {/* Annual export */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm mb-5">
        <h3 className="text-sm font-semibold mb-4">Annual Export</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Year</p>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[110px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.length === 0
                  ? <SelectItem value={String(currentYear)}>{currentYear}</SelectItem>
                  : years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status filter</p>
            <Select value={yearType} onValueChange={setYearType}>
              <SelectTrigger className="w-[140px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-xs text-muted-foreground">{yearlyData.length} records</p>
            <Button
              size="sm"
              onClick={() => downloadCSV(yearlyData, `audit-export-${year}-${yearType}.csv`)}
              disabled={yearlyData.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </div>
        </div>
      </div>

      {/* Quick exports */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Quick Export — All Data</h3>
        <div className="flex flex-wrap gap-3">
          <QuickExportButton
            label="Approved Only"
            count={approvedOnly.length}
            onClick={() => downloadCSV(approvedOnly, "audit-export-approved.csv")}
          />
          <QuickExportButton
            label="All Statuses"
            count={submissions.length}
            onClick={() => downloadCSV(submissions, "audit-export-all.csv")}
          />
          <QuickExportButton
            label="Pending Only"
            count={pendingOnly.length}
            onClick={() => downloadCSV(pendingOnly, "audit-export-pending.csv")}
          />
        </div>
      </div>
    </div>
  );
}

function QuickExportButton({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-4 py-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <FileText className="w-4 h-4 text-primary" />
      <div className="text-left">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{count} records</p>
      </div>
      <Download className="w-3.5 h-3.5 text-muted-foreground ml-2" />
    </button>
  );
}
