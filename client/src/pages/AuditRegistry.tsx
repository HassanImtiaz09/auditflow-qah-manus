// AuditRegistry — tRPC backend
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Archive, ArchiveRestore, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { toast } from "sonner";

export default function AuditRegistry() {
  const utils = trpc.useUtils();
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const { data: audits = [], isLoading } = trpc.audits.list.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const archiveMutation = trpc.audits.archive.useMutation({
    onSuccess: () => utils.audits.list.invalidate(),
    onError: err => toast.error(err.message),
  });

  const filtered = audits.filter(a => {
    if (!showArchived && a.archived) return false;
    if (showArchived && !a.archived) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.refNumber.toLowerCase().includes(q) ||
        (a.submitterName ?? "").toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.topic ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCsv = () => {
    const h = ["Ref", "Category", "Submitter", "Grade", "Priority", "Status", "Setting", "Topic", "Submitted"];
    const r = filtered.map(a => [
      a.refNumber, a.category, a.submitterName ?? "", a.submitterGrade ?? "",
      a.priority, a.status, a.clinicalSetting, a.topic ?? "",
      a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "",
    ]);
    const csv = [h, ...r].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = "audit-registry.csv"; el.click();
    URL.revokeObjectURL(url);
  };

  const isAdmin = currentUser?.auditRole === "admin";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Audit Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">All registered clinical audits for QAH ENT.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived
              ? <><ArchiveRestore className="w-4 h-4 mr-1.5" />Show Active</>
              : <><Archive className="w-4 h-4 mr-1.5" />Show Archived</>}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref, name, category…" className="pl-9 text-sm" />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No audits found.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Submitter</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(audit => (
                <tr key={audit.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{audit.refNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{audit.category}</p>
                    {audit.topic && <p className="text-xs text-muted-foreground">{audit.topic}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{audit.submitterName}</p>
                    <p className="text-xs text-muted-foreground">{audit.submitterGrade}</p>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={audit.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={audit.status} /></td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => archiveMutation.mutate({ auditId: audit.id, archived: !audit.archived })}
                        className="text-xs h-7"
                      >
                        {audit.archived ? "Restore" : "Archive"}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
