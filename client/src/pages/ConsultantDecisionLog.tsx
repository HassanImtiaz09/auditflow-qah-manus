// ConsultantDecisionLog — Consultant-only log of all approve/reject decisions
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Search, Filter, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { getLogs, type AppUser } from "@/lib/store";

interface Props {
  user: AppUser;
}

export default function ConsultantDecisionLog({ user }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const isConsultant = user.role === "consultant" || user.role === "admin";

  const decisionLogs = getLogs().filter(
    (l) => l.event === "approved" || l.event === "rejected"
  );

  const approvedCount = decisionLogs.filter((l) => l.event === "approved").length;
  const rejectedCount = decisionLogs.filter((l) => l.event === "rejected").length;

  const filtered = useMemo(() => {
    return decisionLogs.filter((log) => {
      if (filter !== "all" && log.event !== filter) return false;
      if (search) {
        const term = search.toLowerCase();
        return (
          log.actor.toLowerCase().includes(term) ||
          log.submission_ref.toLowerCase().includes(term) ||
          (log.note?.toLowerCase().includes(term) ?? false)
        );
      }
      return true;
    });
  }, [decisionLogs, search, filter]);

  if (!isConsultant) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <ShieldCheck className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Consultant access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Decision Log</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Complete record of all consultant approval and rejection decisions.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Decisions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{decisionLogs.length}</p>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by consultant, reference..."
            className="pl-9 text-[13px]"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] text-[13px]">
            <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="approved">Approved Only</SelectItem>
            <SelectItem value="rejected">Rejected Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No decisions found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Decision</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Consultant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {log.event === "approved" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 ref-mono text-xs text-muted-foreground">{log.submission_ref}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{log.actor}</p>
                    {log.actor_email && (
                      <p className="text-[11px] text-muted-foreground">{log.actor_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {log.created_date
                      ? format(new Date(log.created_date), "dd MMM yyyy 'at' HH:mm")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                    <span className="line-clamp-2">{log.note || "—"}</span>
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
