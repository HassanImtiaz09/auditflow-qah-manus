/**
 * Dashboard — personal home page for all authenticated users.
 * Shows quick stats, recent submissions, unread notifications, and a CTA to submit a new audit.
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colour: string;
}

function StatCard({ label, value, icon, colour }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colour}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: currentUser } = trpc.auth.currentUser.useQuery();
  const { data: myAudits = [], isLoading: auditsLoading } = trpc.audits.mySubmissions.useQuery();
  const { data: notifications = [], isLoading: notifsLoading } = trpc.notifications.unread.useQuery();
  const utils = trpc.useUtils();

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
  });

  // Compute quick stats
  const total = myAudits.length;
  const pending = myAudits.filter((a) => a.status === "pending").length;
  const approved = myAudits.filter((a) => a.status === "approved").length;
  const rejected = myAudits.filter((a) => a.status === "rejected").length;

  // Recent 5 submissions (newest first)
  const recent = [...myAudits]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Recent 5 unread notifications
  const recentNotifs = notifications.slice(0, 5);

  const firstName = currentUser?.fullName?.split(" ")[0] ?? currentUser?.name ?? "there";

  return (
    <div className="p-6 max-w-5xl">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Good day, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here is a summary of your audit activity.
          </p>
        </div>
        <Button onClick={() => navigate("/submit")} className="shrink-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
    </div>
  );
}
