// ConsultantDecisionLog — tRPC backend
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

export default function ConsultantDecisionLog() {
  const { data: audits = [], isLoading } = trpc.audits.list.useQuery();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const decided = audits.filter(a => a.status === "approved" || a.status === "rejected");
  const approvedCount = decided.filter(a => a.status === "approved").length;
  const rejectedCount = decided.filter(a => a.status === "rejected").length;

  const filtered = decided.filter(a => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.refNumber.toLowerCase().includes(q) ||
        (a.submitterName ?? "").toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Decision Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete record of all consultant approval and rejection decisions.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Decisions</p>
          <p className="text-2xl font-bold mt-1">{decided.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-emerald-700">Approved</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-red-700">Rejected</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{rejectedCount}</p>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reference, submitter…" className="pl-9 text-sm" />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Decisions</option>
          <option value="approved">Approved Only</option>
          <option value="rejected">Rejected Only</option>
        </select>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No decisions recorded yet.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Decision</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Submitter</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(audit => (
                <tr key={audit.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {audit.status === "approved" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <CheckCircle2 className="w-3 h-3" />Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 text-xs font-semibold">
                        <XCircle className="w-3 h-3" />Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{audit.refNumber}</td>
                  <td className="px-4 py-3 font-medium">{audit.category}</td>
                  <td className="px-4 py-3 text-xs">{audit.submitterName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {audit.decidedAt ? format(new Date(audit.decidedAt), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {audit.decisionNote ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
