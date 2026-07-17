/**
 * Dashboard — role-specific home page.
 * Clinician:   submission-focused (drafts, own audit status, quick submit CTA)
 * Consultant:  approval-focused (pending queue, approved/rejected history, deadlines)
 * Admin:       oversight (system-wide stats, audits per consultant, approaching deadlines, recent registrations)
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
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
  Users,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  CalendarClock,
  ListChecks,
  Mail,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { NotificationHistory } from "@/components/NotificationHistory";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663430072618/436kjx9HnHs4DfQBN2oU96/auditflow-logo-EjJ5FaZLtyvkjMQHAcbGWR.webp";

// ─── Shared stat card ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colour: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon, colour, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
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

// ─── Welcome banner ───────────────────────────────────────────────────────────

function WelcomeBanner({
  firstName,
  subtitle,
  cta,
}: {
  firstName: string;
  subtitle: string;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 mb-6 flex items-center justify-between gap-4"
      style={{ background: "oklch(0.19 0.04 255)" }}
    >
      <div className="flex items-center gap-4">
        <img src={LOGO_URL} alt="AuditFlow" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div>
          <h1 className="text-lg font-semibold text-white leading-tight">Good day, {firstName}</h1>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {cta}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICIAN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function ClinicianDashboard({ firstName }: { firstName: string }) {
  const [, navigate] = useLocation();
  const { data: myAudits = [] } = trpc.audits.mySubmissions.useQuery();
  const { data: myDrafts = [], isLoading: draftsLoading } = trpc.audits.myDrafts.useQuery();
  const { data: notifications = [] } = trpc.notifications.unread.useQuery();
  const utils = trpc.useUtils();

  const submitted = myAudits.filter((a) => a.status !== "draft");
  const total = submitted.length;
  const pending = submitted.filter((a) => a.status === "pending").length;
  const approved = submitted.filter((a) => a.status === "approved").length;
  const rejected = submitted.filter((a) => a.status === "rejected").length;
  const changesRequested = submitted.filter((a) => a.status === "changes_requested").length;

  // Upcoming deadlines: own submissions with auditEndDate within 30 days
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const upcomingDeadlines = submitted
    .filter((a) => a.auditEndDate && new Date(a.auditEndDate).getTime() - nowMs > 0 && new Date(a.auditEndDate).getTime() - nowMs <= thirtyDaysMs)
    .sort((a, b) => new Date(a.auditEndDate!).getTime() - new Date(b.auditEndDate!).getTime())
    .slice(0, 5);
  const recent = [...submitted]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

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

  return (
    <div className="p-6 max-w-5xl">
      <WelcomeBanner
        firstName={firstName}
        subtitle="Here is a summary of your audit activity."
        cta={
          <Button
            onClick={() => navigate("/submit")}
            className="shrink-0 bg-white/15 hover:bg-white/25 text-white border-white/20 border"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Audit
          </Button>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Submitted" value={total} icon={<ClipboardList className="w-5 h-5 text-blue-600" />} colour="bg-blue-50" onClick={() => navigate("/check-status")} />
        <StatCard label="Awaiting Review" value={pending} icon={<Clock className="w-5 h-5 text-amber-600" />} colour="bg-amber-50" onClick={() => navigate("/check-status")} />
        <StatCard label="Approved" value={approved} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} colour="bg-emerald-50" onClick={() => navigate("/check-status")} />
        <StatCard label="Rejected" value={rejected} icon={<XCircle className="w-5 h-5 text-red-500" />} colour="bg-red-50" onClick={() => navigate("/check-status")} />
        {changesRequested > 0 && (
          <StatCard label="Changes Requested" value={changesRequested} icon={<AlertTriangle className="w-5 h-5 text-orange-500" />} colour="bg-orange-50" onClick={() => navigate("/check-status")} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Recent submissions */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Submissions</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/check-status")}>
              View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Inbox className="w-7 h-7" />
              <p className="text-xs">No submissions yet. Start your first audit.</p>
              <Button size="sm" variant="outline" className="mt-1 text-xs h-7" onClick={() => navigate("/submit")}>
                <Plus className="w-3.5 h-3.5 mr-1" />Submit Audit
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/check-status?ref=${a.refNumber}`)}>
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.refNumber} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
                  </div>
                  <StatusBadge status={a.status as "draft" | "pending" | "approved" | "rejected" | "changes_requested"} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-blue-200">{notifications.length}</span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Bell className="w-7 h-7" />
              <p className="text-xs">You're all caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => markRead.mutate({ id: n.id })}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === "audit_assigned" ? "bg-violet-500" : n.type === "account_approved" ? "bg-emerald-500" : "bg-blue-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </li>
              ))}
              {notifications.length > 5 && (
                <li className="px-4 py-2 text-center">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground w-full" onClick={() => navigate("/notifications")}>
                    View all {notifications.length} notifications <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-5">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold">Upcoming Deadlines</span>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-orange-200">{upcomingDeadlines.length}</span>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {upcomingDeadlines.map((a) => {
              const daysLeft = Math.ceil((new Date(a.auditEndDate!).getTime() - nowMs) / (24 * 60 * 60 * 1000));
              return (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/check-status?ref=${a.refNumber}`)}>
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.refNumber} · Due {format(new Date(a.auditEndDate!), "dd MMM yyyy")}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    daysLeft <= 3 ? "bg-red-100 text-red-700" : daysLeft <= 7 ? "bg-orange-100 text-orange-700" : "bg-amber-50 text-amber-700"
                  }`}>{daysLeft}d left</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Drafts */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Saved Drafts</span>
            {myDrafts.length > 0 && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-slate-200">{myDrafts.length}</span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/submit")}>
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
                  <p className="text-sm font-medium text-foreground truncate">{d.topic || "Untitled Draft"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {d.category}{d.clinicalSetting ? ` · ${d.clinicalSetting}` : ""} · Saved {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => navigate(`/submit?draftId=${d.id}`)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => submitDraft.mutate({ auditId: d.id })} disabled={submitDraft.isPending}>
                    <Send className="w-3.5 h-3.5 mr-1" />Submit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { if (confirm("Delete this draft?")) deleteDraft.mutate({ auditId: d.id }); }} disabled={deleteDraft.isPending}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSULTANT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function ConsultantDashboard({ firstName }: { firstName: string }) {
  const [, navigate] = useLocation();
  const { data: queue, isLoading: queueLoading } = trpc.audits.myConsultantQueue.useQuery();
  const { data: notifications = [] } = trpc.notifications.unread.useQuery();
  const utils = trpc.useUtils();

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  const pendingCount = queue?.pending.length ?? 0;
  const approvedCount = queue?.approved.length ?? 0;
  const rejectedCount = queue?.rejected.length ?? 0;
  const changesRequestedCount = (queue as any)?.changes_requested?.length ?? 0;

  // Combine all for "recent decisions" (approved + rejected + changes_requested, newest first)
  const recentDecisions = [
    ...(queue?.approved ?? []),
    ...(queue?.rejected ?? []),
    ...((queue as any)?.changes_requested ?? []),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 max-w-5xl">
      <WelcomeBanner
        firstName={firstName}
        subtitle="Here is your audit approval queue and recent decisions."
        cta={
          <Button
            onClick={() => navigate("/approval-queue")}
            className="shrink-0 bg-white/15 hover:bg-white/25 text-white border-white/20 border"
            variant="outline"
          >
            <Gavel className="w-4 h-4 mr-1.5" />
            Open Queue
          </Button>
        }
      />

      {/* Queue stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Awaiting Your Review"
          value={pendingCount}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          colour="bg-amber-50"
          onClick={() => navigate("/approval-queue?status=pending")}
        />
        <StatCard
          label="Approved"
          value={approvedCount}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          colour="bg-emerald-50"
          onClick={() => navigate("/approval-queue?status=approved")}
        />
        <StatCard
          label="Rejected"
          value={rejectedCount}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          colour="bg-red-50"
          onClick={() => navigate("/approval-queue?status=rejected")}
        />
        {changesRequestedCount > 0 && (
          <StatCard
            label="Changes Requested"
            value={changesRequestedCount}
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            colour="bg-orange-50"
            onClick={() => navigate("/approval-queue?status=changes_requested")}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Pending audits needing review */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold">Awaiting Review</span>
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-amber-200">{pendingCount}</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/approval-queue?status=pending")}>
              Review all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {queueLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : (queue?.pending ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              <p className="text-xs">All clear — no audits awaiting review.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(queue?.pending ?? []).slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate("/approval-queue?status=pending")}>
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.refNumber} · {a.submitterName ?? "Unknown"}</p>
                  </div>
                  <PriorityBadge priority={a.priority as string} />
                </li>
              ))}
              {pendingCount > 5 && (
                <li className="px-4 py-2 text-center">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground w-full" onClick={() => navigate("/approval-queue?status=pending")}>
                    +{pendingCount - 5} more <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Recent decisions */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Decisions</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/decision-log")}>
              Full log <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {recentDecisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Inbox className="w-7 h-7" />
              <p className="text-xs">No decisions made yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentDecisions.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.refNumber} · {a.submitterName ?? "Unknown"}</p>
                  </div>
                  <StatusBadge status={a.status as "draft" | "pending" | "approved" | "rejected" | "changes_requested"} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {notifications.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-blue-200">{notifications.length}</span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Bell className="w-7 h-7" />
            <p className="text-xs">You're all caught up!</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => markRead.mutate({ id: n.id })}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === "audit_assigned" ? "bg-violet-500" : n.type === "account_approved" ? "bg-emerald-500" : "bg-blue-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </div>
              </li>
            ))}
            {notifications.length > 5 && (
              <li className="px-4 py-2 text-center">
                <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground w-full" onClick={() => navigate("/notifications")}>
                  View all {notifications.length} notifications <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Email notification history */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-5">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Email Notification History</span>
        </div>
        <div className="p-4">
          <NotificationHistory supervisorMode={true} limit={20} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function AdminDashboard({ firstName }: { firstName: string }) {
  const [, navigate] = useLocation();
  const { data: stats } = trpc.admin.overviewStats.useQuery();
  const { data: perConsultant = [], isLoading: consultantLoading } = trpc.admin.auditsPerConsultant.useQuery();
  const { data: deadlines = [], isLoading: deadlinesLoading } = trpc.admin.approachingDeadlines.useQuery();
  const { data: recent = [], isLoading: recentLoading } = trpc.admin.recentRegistrations.useQuery();
  const { data: pendingUsers = [] } = trpc.users.pending.useQuery();
  const { data: notifications = [] } = trpc.notifications.unread.useQuery();
  const utils = trpc.useUtils();

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  const pendingConsultants = pendingUsers.filter((u) => u.auditRole === "consultant");

  return (
    <div className="p-6 max-w-6xl">
      <WelcomeBanner
        firstName={firstName}
        subtitle="System-wide audit oversight — monitor progress, workload, and approaching deadlines."
        cta={
          <Button
            onClick={() => navigate("/registry")}
            className="shrink-0 bg-white/15 hover:bg-white/25 text-white border-white/20 border"
            variant="outline"
          >
            <ClipboardList className="w-4 h-4 mr-1.5" />
            Audit Registry
          </Button>
        }
      />

      {/* System-wide stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Registered" value={stats?.total ?? 0} icon={<ClipboardList className="w-5 h-5 text-blue-600" />} colour="bg-blue-50" onClick={() => navigate("/registry")} />
        <StatCard label="Pending Review" value={stats?.pending ?? 0} icon={<Clock className="w-5 h-5 text-amber-600" />} colour="bg-amber-50" onClick={() => navigate("/registry")} />
        <StatCard label="Approved" value={stats?.approved ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} colour="bg-emerald-50" onClick={() => navigate("/registry")} />
        <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={<XCircle className="w-5 h-5 text-red-500" />} colour="bg-red-50" onClick={() => navigate("/registry")} />
      </div>

      {/* Pending approvals alert */}
      {pendingConsultants.length > 0 && (
        <div
          className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate("/approvals")}
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {pendingConsultants.length} consultant registration{pendingConsultants.length > 1 ? "s" : ""} awaiting approval
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {pendingConsultants.map((u) => u.fullName ?? u.name).join(", ")}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Audits per consultant workload table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Consultant Workload</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/statistics")}>
              Statistics <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {consultantLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : perConsultant.filter(c => c.total > 0).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Users className="w-7 h-7" />
              <p className="text-xs">No audits registered against any consultant yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Consultant</th>
                    <th className="text-center px-3 py-2 font-semibold text-amber-600">Pending</th>
                    <th className="text-center px-3 py-2 font-semibold text-emerald-600">Approved</th>
                    <th className="text-center px-3 py-2 font-semibold text-red-500">Rejected</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {perConsultant
                    .filter(c => c.total > 0)
                    .sort((a, b) => b.total - a.total)
                    .map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground truncate max-w-[160px]">{c.fullName}</p>
                          {c.grade && <p className="text-muted-foreground text-[10px]">{c.grade}</p>}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${c.pending > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{c.pending}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${c.approved > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{c.approved}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold ${c.rejected > 0 ? "text-red-500" : "text-muted-foreground"}`}>{c.rejected}</span>
                        </td>
                        <td className="text-center px-3 py-2.5 font-semibold text-foreground">{c.total}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Approaching deadlines */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold">Approaching Deadlines</span>
              <span className="text-[10px] text-muted-foreground">(next 30 days)</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/calendar")}>
              Calendar <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {deadlinesLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : deadlines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <CalendarClock className="w-7 h-7 text-emerald-400" />
              <p className="text-xs">No approaching deadlines in the next 30 days.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {deadlines.slice(0, 6).map((a) => {
                const urgent = (a.daysRemaining ?? 99) <= 7;
                return (
                  <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {a.refNumber} · {a.supervisorName ?? "No consultant"} · Due {a.auditEndDate ? format(new Date(a.auditEndDate), "d MMM yyyy") : "—"}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {a.daysRemaining}d
                    </span>
                  </li>
                );
              })}
              {deadlines.length > 6 && (
                <li className="px-4 py-2 text-center">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground w-full" onClick={() => navigate("/calendar")}>
                    +{deadlines.length - 6} more <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent registrations */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Registrations</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/registry")}>
              Full registry <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Button>
          </div>
          {recentLoading ? (
            <p className="text-xs text-muted-foreground p-4">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Inbox className="w-7 h-7" />
              <p className="text-xs">No audits registered yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{a.topic || a.category}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.refNumber} · {a.submitterName ?? "Unknown"} · {a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : ""}
                    </p>
                  </div>
                  <StatusBadge status={a.status as "draft" | "pending" | "approved" | "rejected" | "changes_requested"} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none border border-blue-200">{notifications.length}</span>
              )}
            </div>
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
              <Bell className="w-7 h-7" />
              <p className="text-xs">You're all caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => markRead.mutate({ id: n.id })}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === "audit_assigned" ? "bg-violet-500" : n.type === "account_approved" ? "bg-emerald-500" : "bg-blue-500"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                  </div>
                </li>
              ))}
              {notifications.length > 5 && (
                <li className="px-4 py-2 text-center">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground w-full" onClick={() => navigate("/notifications")}>
                    View all {notifications.length} notifications <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — routes to the correct role view
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { data: currentUser, isLoading } = trpc.auth.currentUser.useQuery();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const firstName = currentUser?.fullName?.split(" ")[0] ?? currentUser?.name ?? "there";
  const role = currentUser?.auditRole ?? "clinician";

  if (role === "admin") return <AdminDashboard firstName={firstName} />;
  if (role === "consultant") return <ConsultantDashboard firstName={firstName} />;
  return <ClinicianDashboard firstName={firstName} />;
}
