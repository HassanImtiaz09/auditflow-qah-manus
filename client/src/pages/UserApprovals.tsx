// UserApprovals — Admin-only pending user approval queue
// Shows all users awaiting approval (unapproved accounts + consultants with role_approved=false)
// Displays grade, role, registration date, and consultant-specific notification context

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Mail,
  ShieldCheck,
  Bell,
  User,
} from "lucide-react";
import { format } from "date-fns";
import {
  getAllUsers,
  approveUser,
  rejectUser,
  getNotifications,
  markNotificationRead,
  type AppUser,
} from "@/lib/store";

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function UserApprovals({ user, onRefresh }: Props) {
  const [, forceUpdate] = useState(0);

  // Pending = unapproved accounts OR consultants awaiting role approval
  const pending = getAllUsers().filter((u) => !u.approved || (u.role === "consultant" && !u.role_approved));
  const notifications = getNotifications().filter((n) => !n.read);

  const handleApprove = (u: AppUser) => {
    approveUser(u.id);
    toast.success(`${u.full_name} approved — they can now log in as a ${u.role}.`);
    forceUpdate((n) => n + 1);
    onRefresh();
  };

  const handleReject = (u: AppUser) => {
    rejectUser(u.id);
    toast.success(`${u.full_name}'s registration has been removed.`);
    forceUpdate((n) => n + 1);
    onRefresh();
  };

  const handleMarkRead = (userId: string) => {
    const notif = getNotifications().find((n) => n.user_id === userId && !n.read);
    if (notif) {
      markNotificationRead(notif.id);
      forceUpdate((n) => n + 1);
    }
  };

  if (user.role !== "admin") {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <ClipboardCheck className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">User Approvals</h2>
        <span className="text-sm text-muted-foreground">{pending.length} pending</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Review and approve or reject new user registration requests. Consultant registrations require explicit role approval before they can access the audit approval queue.
      </p>

      {/* Unread notifications banner */}
      {notifications.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {notifications.length} new consultant registration{notifications.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-1">
              {notifications.map((n) => (
                <p key={n.id} className="text-xs text-amber-700 leading-relaxed">
                  {n.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
          <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No pending approvals</p>
          <p className="text-xs text-muted-foreground mt-1">All user registrations have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((u) => {
            const isConsultantRequest = u.role === "consultant" && !u.role_approved;
            const hasUnreadNotif = notifications.some((n) => n.user_id === u.id);

            return (
              <div
                key={u.id}
                className={`bg-card rounded-xl border shadow-sm p-5 ${
                  isConsultantRequest
                    ? "border-amber-300 bg-amber-50/30"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        isConsultantRequest
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {u.full_name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[13px] font-semibold text-foreground">{u.full_name}</p>
                        {isConsultantRequest && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 h-4 hover:bg-amber-100">
                            <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                            Consultant Request
                          </Badge>
                        )}
                        {hasUnreadNotif && (
                          <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 hover:bg-red-500">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Mail className="w-3 h-3" />
                        {u.email}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {u.grade && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="w-3 h-3" />
                            {u.grade}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          Registered {format(new Date(u.created_date), "dd MMM yyyy 'at' HH:mm")}
                        </span>
                      </div>
                      {isConsultantRequest && (
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                          This user registered as a <strong>{u.grade}</strong> and is requesting consultant-level access to approve and reject audit submissions. Approving will grant them access to the Approval Queue.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        handleApprove(u);
                        if (hasUnreadNotif) handleMarkRead(u.id);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => handleReject(u)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
