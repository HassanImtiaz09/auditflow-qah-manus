// AuditRegistry — Full searchable/filterable table of all audits
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Archive,
  ArchiveRestore,
  BookOpen,
} from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { AUDIT_CATEGORIES } from "@/lib/auditConstants";
import { format } from "date-fns";
import {
  getSubmissions,
  updateSubmission,
  deleteSubmission,
  createLog,
  type AuditSubmission,
  type AppUser,
} from "@/lib/store";

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

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function AuditRegistry({ user, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<AuditSubmission | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const isConsultant = user.role === "consultant" || user.role === "admin";

  const submissions = getSubmissions();

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (!showArchived && s.archived) return false;
      if (showArchived && !s.archived) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (categoryFilter !== "all" && s.type !== categoryFilter) return false;
      if (search) {
        const term = search.toLowerCase();
        return (
          s.ref.toLowerCase().includes(term) ||
          s.auditor.toLowerCase().includes(term) ||
          s.type.toLowerCase().includes(term) ||
          (s.topic?.toLowerCase().includes(term) ?? false) ||
          (s.serial?.toLowerCase().includes(term) ?? false)
        );
      }
      return true;
    });
  }, [submissions, search, statusFilter, categoryFilter, showArchived]);

  const toggleCheck = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const exportSelected = () => {
    const rows = filtered.filter((s) => checkedIds.has(s.id));
    downloadCSV(rows, `audit-export-selected-${Date.now()}.csv`);
    toast.success(`Exported ${rows.length} record${rows.length !== 1 ? "s" : ""}`);
  };

  const handleArchive = (sub: AuditSubmission, archive: boolean) => {
    updateSubmission(sub.id, { archived: archive });
    createLog({
      submission_id: sub.id,
      submission_ref: sub.ref,
      event: archive ? "archived" : "restored",
      actor: user.full_name,
      actor_email: user.email,
    });
    toast.success(archive ? "Submission archived" : "Submission restored");
    setSelected(null);
    onRefresh();
  };

  const handleDelete = (id: string) => {
    deleteSubmission(id);
    toast.success("Submission deleted");
    setSelected(null);
    onRefresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">Audit Registry</h2>
        <span className="text-sm text-muted-foreground">{filtered.length} records</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Complete registry of all audit submissions.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, auditor, topic..."
            className="pl-9 text-[13px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {AUDIT_CATEGORIES.map((c) => (
              <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className={showArchived ? "bg-slate-100" : ""}
        >
          <Archive className="w-3.5 h-3.5 mr-1" />
          {showArchived ? "Active" : "Archived"}
        </Button>
        {checkedIds.size > 0 && (
          <Button size="sm" variant="outline" onClick={exportSelected}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export {checkedIds.size}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No records found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 w-8">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {checkedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Auditor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setSelected(sub)}
                  >
                    <td className="px-4 py-3" onClick={(e) => toggleCheck(e, sub.id)}>
                      {checkedIds.has(sub.id)
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3">
                      <p className="ref-mono text-xs text-foreground">{sub.ref}</p>
                      {sub.serial && <p className="ref-mono text-[10px] text-muted-foreground">{sub.serial}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{sub.auditor}</p>
                      <p className="text-[11px] text-muted-foreground">{sub.grade}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{sub.type}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={sub.priority} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(sub.created_date), "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg animate-modal-in">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selected?.topic || selected?.type}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-[13px]">
              <div className="flex items-center gap-2">
                <span className="ref-mono text-xs text-muted-foreground">{selected.ref}</span>
                <StatusBadge status={selected.status} />
                <PriorityBadge priority={selected.priority} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Auditor</p><p className="font-medium mt-0.5">{selected.auditor}</p></div>
                <div><p className="text-xs text-muted-foreground">Grade</p><p className="font-medium mt-0.5">{selected.grade}</p></div>
                <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium mt-0.5">{selected.type}</p></div>
                <div><p className="text-xs text-muted-foreground">Setting</p><p className="font-medium mt-0.5">{selected.setting}</p></div>
                {selected.period && <div><p className="text-xs text-muted-foreground">Period</p><p className="font-medium mt-0.5">{selected.period}</p></div>}
                {selected.sample && <div><p className="text-xs text-muted-foreground">Sample</p><p className="font-medium mt-0.5">{selected.sample}</p></div>}
              </div>
              {selected.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground leading-relaxed">{selected.description}</p>
                </div>
              )}
              {selected.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700 font-medium">Rejection reason</p>
                  <p className="text-xs text-red-600 mt-1">{selected.rejection_reason}</p>
                </div>
              )}
              {isConsultant && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleArchive(selected, !selected.archived)}
                  >
                    {selected.archived
                      ? <><ArchiveRestore className="w-3.5 h-3.5 mr-1" />Restore</>
                      : <><Archive className="w-3.5 h-3.5 mr-1" />Archive</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDelete(selected.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
