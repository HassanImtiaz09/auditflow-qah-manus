// Notifications page — personal in-app notifications for all users
import { Bell, CheckCheck, CheckCircle2, XCircle, RefreshCw, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ─── Icon + colour per notification type ─────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; colour: string; label: string }
> = {
  audit_approved: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    colour: "text-emerald-600 bg-emerald-50 border-emerald-200",
    label: "Audit Approved",
  },
  audit_rejected: {
    icon: <XCircle className="w-4 h-4" />,
    colour: "text-red-600 bg-red-50 border-red-200",
    label: "Audit Rejected",
  },
  audit_reassigned: {
    icon: <RefreshCw className="w-4 h-4" />,
    colour: "text-purple-600 bg-purple-50 border-purple-200",
    label: "Audit Assigned",
  },
  consultant_registered: {
    icon: <ClipboardCheck className="w-4 h-4" />,
    colour: "text-blue-600 bg-blue-50 border-blue-200",
    label: "New Registration",
  },
  audit_submitted: {
    icon: <Bell className="w-4 h-4" />,
    colour: "text-blue-600 bg-blue-50 border-blue-200",
    label: "Audit Submitted",
  },
};

export default function Notifications() {
  const utils = trpc.useUtils();
  const { data: notifications = [], isLoading } = trpc.notifications.unread.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.unread.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unread.invalidate();
      toast.success("All notifications marked as read.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your unread alerts — audit decisions, assignments, and registrations.
          </p>
        </div>
        {notifications.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No unread notifications</p>
          <p className="text-xs text-muted-foreground mt-1">You are all caught up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? {
              icon: <Bell className="w-4 h-4" />,
              colour: "text-gray-600 bg-gray-50 border-gray-200",
              label: n.type,
            };
            return (
              <div
                key={n.id}
                className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-start gap-4"
              >
                {/* Icon badge */}
                <span
                  className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border ${cfg.colour}`}
                >
                  {cfg.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                    {cfg.label}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Dismiss */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 text-xs h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => markReadMutation.mutate({ id: n.id })}
                  disabled={markReadMutation.isPending}
                >
                  Dismiss
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
