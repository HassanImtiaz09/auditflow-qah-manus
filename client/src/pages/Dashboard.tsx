/**
 * Dashboard — personal home page for all authenticated users.
 * Shows quick stats, recent submissions, unread notifications, drafts, and a CTA to submit a new audit.
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  Plus,
  ChevronRight,
  FileText,
  Inbox,
  Pencil,
  Trash2,
  Send,
  Gavel,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colour: string;
}

function StatCard({ label, value, icon, colour }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colour}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const { data: myAudits = [], isLoading: auditsLoading } = trpc.audits.mySubmissions.useQuery();
  const { data: myDrafts = [], isLoading: draftsLoading } = trpc.audits.myDrafts.useQuery();
  const { data: notifications = [], isLoading: notifsLoading } = trpc.notifications.unread.useQuery();
  const utils = trpc.useUtils();

  // Consultant/admin: fetch queue grouped by status
  const isConsultantOrAdmin = currentUser?.auditRole === "consultant" || currentUser?.auditRole === "admin";
  const { data: consultantQueue, isLoading: queueLoading } = trpc.audits.myConsultantQueue.useQuery(
    undefined,
    { enabled: isConsultantOrAdmin }
  );

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  const deleteDraft = trpc.audits.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft deleted");
      utils.audits.myDrafts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const submitDraft = trpc.audits.submitDraft.useMutation({
    onSuccess: (res) => {
      toast.success(`Audit submitted — ${res.refNumber}`);
      utils.audits.myDrafts.invalidate();
      utils.audits.mySubmissions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Compute quick stats (exclude drafts from counts)
  const submitted = myAudits.filter((a) => a.status !== "draft");
  const total = submitted.length;
  const pending = submitted.filter((a) => a.status === "pending").length;
  const approved = submitted.filter((a) => a.status === "approved").length;
  const rejected = submitted.filter((a) => a.status === "rejected").length;

  // Recent 5 submissions (newest first, exclude drafts)
  const recent = [...submitted]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Recent 5 unread notifications
  const recentNotifs = notifications.slice(0, 5);

  const firstName = currentUser?.fullName?.split(" ")[0] ?? currentUser?.name ?? "there";

  const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663430072618/436kjx9HnHs4DfQBN2oU96/auditflow-logo-EjJ5FaZLtyvkjMQHAcbGWR.webp";

  return (
    <div className="p-6 max-w-5xl">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4"
        style={{ background: "oklch(0.19 0.04 255)" }}
      >
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} alt="AuditFlow" className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">
              Good day, {firstName}
            </h1>
            <p className="text-sm text-white/60 mt-0.5">
              Here is a summary of your audit activity.
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/submit")}
          className="shrink-0 bg-white/15 hover:bg-white/25 text-white border-white/20 border"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Audit
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Submitted"
          value={total}
          icon={<ClipboardList className="w-5 h-5 text-blue-600" />}
          colour="bg-blue-50"
        />
        <StatCard
          label="Awaiting Review"
          value={pending}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          colour="bg-amber-50"
        />
        <StatCard
          label="Approved"
          value={approved}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          colour="bg-emerald-50"
        />
        <StatCard
          label="Rejected"
          value={rejected}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          colour="bg-red-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Recent submissions */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Submissions</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground"
              onClick={() => navigate("/check-status")}
            >
              View all
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>

          {auditsLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Inbox className="w-7 h-7" />
              <p className="text-xs">No submissions yet.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 text-xs h-7"
                onClick={() => navigate("/submit")}
              >
                Submit your first audit
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate("/check-status")}
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-xs font-mono text-muted-foreground">{a.refNumber}</p>
                    <p className="text-sm font-medium text-foreground truncate mt-0.5">
                      {a.topic || a.category}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.submittedAt
                        ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true })
                        : "Draft"}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Unread notifications */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                Mark all read
              </Button>
            )}
          </div>

          {notifsLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : recentNotifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Bell className="w-7 h-7" />
              <p className="text-xs">You are all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentNotifs.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => markRead.mutate({ id: n.id })}
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      n.type === "audit_approved"
                        ? "bg-emerald-500"
                        : n.type === "audit_rejected"
                        ? "bg-red-500"
                        : n.type === "audit_reassigned"
                        ? "bg-blue-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
              {notifications.length > 5 && (
                <li className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-muted-foreground w-full"
                    onClick={() => navigate("/notifications")}
                  >
                    View all {notifications.length} notifications
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Consultant / Admin queue section */}
      {isConsultantOrAdmin && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-foreground">Your Approval Queue</h2>
          </div>
          {queueLoading ? (
            <p className="text-xs text-muted-foreground">Loading queue…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Awaiting approval */}
              <div
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate("/approval-queue")}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Awaiting Approval</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-amber-700 leading-none">
                  {consultantQueue?.pending.length ?? 0}
                </p>
                {(consultantQueue?.pending.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1">
                    {consultantQueue!.pending.slice(0, 3).map((a) => (
                      <li key={a.id} className="text-xs text-amber-800 truncate">
                        {a.refNumber} — {a.topic ?? a.category}
                      </li>
                    ))}
                    {consultantQueue!.pending.length > 3 && (
                      <li className="text-xs text-amber-600 font-medium">
                        +{consultantQueue!.pending.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-0.5">
                  View queue <ChevronRight className="w-3 h-3" />
                </p>
              </div>

              {/* Approved */}
              <div
                className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate("/approval-queue")}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Approved</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-emerald-700 leading-none">
                  {consultantQueue?.approved.length ?? 0}
                </p>
                {(consultantQueue?.approved.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1">
                    {consultantQueue!.approved.slice(0, 3).map((a) => (
                      <li key={a.id} className="text-xs text-emerald-800 truncate">
                        {a.refNumber} — {a.topic ?? a.category}
                      </li>
                    ))}
                    {consultantQueue!.approved.length > 3 && (
                      <li className="text-xs text-emerald-600 font-medium">
                        +{consultantQueue!.approved.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-0.5">
                  View history <ChevronRight className="w-3 h-3" />
                </p>
              </div>

              {/* Rejected */}
              <div
                className="bg-red-50 border border-red-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate("/approval-queue")}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Rejected</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-700 leading-none">
                  {consultantQueue?.rejected.length ?? 0}
                </p>
                {(consultantQueue?.rejected.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1">
                    {consultantQueue!.rejected.slice(0, 3).map((a) => (
                      <li key={a.id} className="text-xs text-red-800 truncate">
                        {a.refNumber} — {a.topic ?? a.category}
                      </li>
                    ))}
                    {consultantQueue!.rejected.length > 3 && (
                      <li className="text-xs text-red-600 font-medium">
                        +{consultantQueue!.rejected.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-[11px] text-red-600 mt-2 flex items-center gap-0.5">
                  View history <ChevronRight className="w-3 h-3" />
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drafts section */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Saved Drafts</span>
            {myDrafts.length > 0 && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-slate-200">
                {myDrafts.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-muted-foreground"
            onClick={() => navigate("/submit")}
          >
            <Plus className="w-3.5 h-3.5 mr-0.5" />New draft
          </Button>
        </div>

        {draftsLoading ? (
          <p className="text-xs text-muted-foreground p-4">Loading…</p>
        ) : myDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <FileText className="w-7 h-7" />
            <p className="text-xs">No saved drafts. Start an audit and save it to continue later.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {myDrafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-medium text-foreground truncate">
                    {d.topic || "Untitled Draft"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {d.category}{d.clinicalSetting ? ` · ${d.clinicalSetting}` : ""}
                    {" · "}Saved {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => navigate(`/submit?draftId=${d.id}`)}
                    title="Continue editing"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => submitDraft.mutate({ auditId: d.id })}
                    disabled={submitDraft.isPending}
                    title="Submit this draft"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />Submit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm("Delete this draft? This cannot be undone.")) {
                        deleteDraft.mutate({ auditId: d.id });
                      }
                    }}
                    disabled={deleteDraft.isPending}
                    title="Delete draft"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
