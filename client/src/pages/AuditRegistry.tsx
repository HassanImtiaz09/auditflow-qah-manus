// AuditRegistry -- with expandable audit trail history panel
import { useState } from "react";
import CommentThread from "@/components/shared/CommentThread";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Archive,
  ArchiveRestore,
  Download,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  ArchiveIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { toast } from "sonner";

interface ReassignState {
  auditId: number;
  auditRef: string;
  currentSupervisorId: number | null;
}

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; colour: string }
> = {
  submitted: {
    label: "Submitted",
    icon: <FileText className="w-3.5 h-3.5" />,
    colour: "text-blue-600 bg-blue-50 border-blue-200",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colour: "text-green-600 bg-green-50 border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-3.5 h-3.5" />,
    colour: "text-red-600 bg-red-50 border-red-200",
  },
  reassigned: {
    label: "Reassigned",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    colour: "text-purple-600 bg-purple-50 border-purple-200",
  },
  archived: {
    label: "Archived",
    icon: <ArchiveIcon className="w-3.5 h-3.5" />,
    colour: "text-gray-600 bg-gray-50 border-gray-200",
  },
  unarchived: {
    label: "Restored",
    icon: <ArchiveRestore className="w-3.5 h-3.5" />,
    colour: "text-gray-600 bg-gray-50 border-gray-200",
  },
  draft_saved: {
    label: "Draft saved",
    icon: <Clock className="w-3.5 h-3.5" />,
    colour: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
};

// ─── History panel (lazy-loaded per audit) ────────────────────────────────────

function AuditHistoryPanel({ auditId }: { auditId: number }) {
  const { data: events = [], isLoading, isError, refetch } = trpc.audits.history.useQuery({ auditId });

  if (isLoading) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground animate-pulse">
        Loading history...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center gap-3">
        <p className="text-sm text-red-600">Failed to load audit trail.</p>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground italic">
        No history recorded for this audit.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-muted/30 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Audit Trail
      </p>
      <ol className="relative border-l border-border ml-2 space-y-4">
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.eventType] ?? {
            label: ev.eventType,
            icon: <Clock className="w-3.5 h-3.5" />,
            colour: "text-gray-600 bg-gray-50 border-gray-200",
          };
          return (
            <li key={ev.id} className="ml-4">
              {/* Timeline dot */}
              <span
                className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full border ${cfg.colour}`}
              >
                {cfg.icon}
              </span>
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.colour}`}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{ev.actorName ?? "System"}</span>
                  </p>
                  {ev.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(ev.createdAt).toLocaleString()}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditRegistry() {
  const utils = trpc.useUtils();
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const isAdmin = currentUser?.auditRole === "admin";
  // Admins use the full registry; non-admins use the scoped view (own audits only)
  const { data: adminAudits = [], isLoading: adminLoading } = trpc.audits.list.useQuery(
    undefined,
    { enabled: isAdmin }
  );
  const { data: myAudits = [], isLoading: myLoading } = trpc.audits.myAuditsRegistry.useQuery(
    undefined,
    { enabled: !isAdmin }
  );
  const audits = isAdmin ? adminAudits : myAudits;
  const isLoading = isAdmin ? adminLoading : myLoading;
  const { data: consultants = [] } = trpc.audits.consultants.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [reassignState, setReassignState] = useState<ReassignState | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");

  const archiveMutation = trpc.audits.archive.useMutation({
    onSuccess: () => {
      utils.audits.list.invalidate();
      utils.audits.myAuditsRegistry.invalidate(); // keep non-admin view in sync
      utils.audits.myQueue.invalidate();           // keep sidebar badge in sync
      utils.audits.myConsultantQueue.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reassignMutation = trpc.audits.reassign.useMutation({
    onSuccess: () => {
      utils.audits.list.invalidate();
      utils.audits.myAuditsRegistry.invalidate();
      setReassignState(null);
      toast.success("Supervisor updated successfully.");
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = audits.filter((a) => {
    if (!showArchived && a.archived) return false;
    if (showArchived && !a.archived) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.refNumber.toLowerCase().includes(q) ||
        (a.submitterName ?? "").toLowerCase().includes(q) ||
        (a.category ?? "").toLowerCase().includes(q) ||
        (a.topic ?? "").toLowerCase().includes(q) ||
        (a.supervisorName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCsv = () => {
    const h = [
      "Ref",
      "Category",
      "Submitter",
      "Grade",
      "Supervisor",
      "Priority",
      "Status",
      "Setting",
      "Topic",
      "Submitted",
    ];
    const r = filtered.map((a) => [
      a.refNumber,
      a.category,
      a.submitterName ?? "",
      a.submitterGrade ?? "",
      a.supervisorName ?? "Unassigned",
      a.priority,
      a.status,
      a.clinicalSetting,
      a.topic ?? "",
      a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "",
    ]);
    const csv = [h, ...r]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "audit-registry.csv";
    el.click();
    URL.revokeObjectURL(url);
  };

  const openReassign = (audit: (typeof audits)[0]) => {
    setReassignState({
      auditId: audit.id,
      auditRef: audit.refNumber,
      currentSupervisorId: audit.supervisorId ?? null,
    });
    setSelectedSupervisorId(audit.supervisorId?.toString() ?? "none");
  };

  const handleReassignConfirm = () => {
    if (!reassignState) return;
    const newId =
      selectedSupervisorId === "none" ? null : parseInt(selectedSupervisorId, 10);
    reassignMutation.mutate({
      auditId: reassignState.auditId,
      supervisorId: newId,
    });
  };

  const toggleHistory = (auditId: number) => {
    setExpandedId((prev) => (prev === auditId ? null : auditId));
  };

  const [pdfLoading, setPdfLoading] = useState(false);

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const auditsWithHistory = await utils.audits.listWithHistory.fetch();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Title block
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("QAH ENT Audit Registry", 14, 16);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(
        `Portsmouth Hospitals University NHS Trust  ·  Exported ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
        14,
        22
      );
      doc.setTextColor(0);

      let y = 30;

      for (const audit of auditsWithHistory) {
        // Check if we need a new page (leave 60 mm for at least the header + one row)
        if (y > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          y = 14;
        }

        // Audit header
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${audit.refNumber}  —  ${audit.category ?? ""}`, 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80);
        const meta = [
          audit.topic ? `Topic: ${audit.topic}` : null,
          `Submitter: ${audit.submitterName ?? "—"} (${audit.submitterGrade ?? "—"})`,
          `Supervisor: ${audit.supervisorName ?? "Unassigned"}`,
          `Priority: ${audit.priority}`,
          `Status: ${audit.status.toUpperCase()}`,
          audit.submittedAt ? `Submitted: ${new Date(audit.submittedAt).toLocaleDateString("en-GB")}` : null,
        ].filter(Boolean).join("   ·   ");
        doc.text(meta, 14, y + 5);
        doc.setTextColor(0);
        y += 12;

        // Audit trail table
        if (audit.history.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [["Event", "Actor", "Detail", "Date / Time"]],
            body: audit.history.map((ev) => [
              ev.eventType.charAt(0).toUpperCase() + ev.eventType.slice(1),
              ev.actorName ?? "System",
              ev.detail ?? "",
              new Date(ev.createdAt).toLocaleString("en-GB"),
            ]),
            theme: "striped",
            headStyles: { fillColor: [15, 39, 68], fontSize: 7, textColor: 255 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 28 }, 3: { cellWidth: 40 } },
            margin: { left: 14, right: 14 },
            tableWidth: pageW - 28,
          });
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
        } else {
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text("No audit trail recorded.", 14, y);
          doc.setTextColor(0);
          y += 8;
        }

        // Separator line
        doc.setDrawColor(220);
        doc.line(14, y - 2, pageW - 14, y - 2);
        y += 4;
      }

      doc.save(`audit-registry-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exported successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Audit Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All registered clinical audits for QAH ENT. Click any row to view its
            audit trail.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="w-4 h-4 mr-1.5" />
                Show Active
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 mr-1.5" />
                Show Archived
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={pdfLoading}
          >
            <FileText className="w-4 h-4 mr-1.5" />
            {pdfLoading ? "Generating…" : "Export PDF"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ref, name, category, supervisor..."
            className="pl-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No audits found.
        </p>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Reference
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Submitter
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Supervisor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Priority
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((audit) => (
                <>
                  <tr
                    key={audit.id}
                    className="border-t border-border hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => toggleHistory(audit.id)}
                  >
                    {/* Expand chevron */}
                    <td className="px-3 py-3 text-muted-foreground">
                      {expandedId === audit.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {audit.refNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{audit.category}</p>
                      {audit.topic && (
                        <p className="text-xs text-muted-foreground">{audit.topic}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{audit.submitterName}</p>
                      <p className="text-xs text-muted-foreground">
                        {audit.submitterGrade}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {audit.supervisorName ? (
                        <span className="text-sm">{audit.supervisorName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={audit.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={audit.status} />
                    </td>
                    {isAdmin && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-1">
                          {audit.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReassign(audit)}
                              className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              Reassign
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              archiveMutation.mutate({
                                auditId: audit.id,
                                archived: !audit.archived,
                              })
                            }
                            className="text-xs h-7"
                          >
                            {audit.archived ? "Restore" : "Archive"}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* Expandable history panel + comment thread */}
                  {expandedId === audit.id && (
                    <tr key={`history-${audit.id}`} className="border-t border-border">
                      <td colSpan={isAdmin ? 8 : 7} className="p-0">
                        {/* Linked re-audit badge */}
                        {audit.linkedAuditRef && (
                          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Re-audit of:</span>
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-mono px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                              {audit.linkedAuditRef}
                            </span>
                          </div>
                        )}
                        <AuditHistoryPanel auditId={audit.id} />
                        <CommentThread
                          auditId={audit.id}
                          submittedById={audit.submittedById}
                          supervisorId={audit.supervisorId}
                          currentUser={currentUser}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!reassignState}
        onOpenChange={(open) => {
          if (!open) setReassignState(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Supervising Consultant</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              Audit{" "}
              <span className="font-mono font-semibold text-foreground">
                {reassignState?.auditRef}
              </span>{" "}
              -- select a new supervising consultant or remove the assignment.
            </p>
            <label className="block text-sm font-medium mb-1.5">
              Supervising Consultant
            </label>
            <select
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="none">-- No supervisor assigned --</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id.toString()}>
                  {c.fullName}
                  {c.grade ? ` -- ${c.grade}` : ""}
                </option>
              ))}
            </select>
            {consultants.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No approved consultants are registered yet.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignState(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassignConfirm}
              disabled={reassignMutation.isPending}
            >
              {reassignMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
