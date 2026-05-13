// UserApprovals — Admin-only pending user approval queue
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ClipboardCheck, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  getAllUsers,
  approveUser,
  rejectUser,
  type AppUser,
} from "@/lib/store";

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function UserApprovals({ user, onRefresh }: Props) {
  const [, forceUpdate] = useState(0);

  const pending = getAllUsers().filter((u) => !u.approved);

  const handleApprove = (u: AppUser) => {
    approveUser(u.id);
    toast.success(`${u.full_name} approved`);
    forceUpdate((n) => n + 1);
    onRefresh();
  };

  const handleReject = (u: AppUser) => {
    rejectUser(u.id);
    toast.success(`${u.full_name} removed`);
    forceUpdate((n) => n + 1);
    onRefresh();
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
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground">User Approvals</h2>
        <span className="text-sm text-muted-foreground">{pending.length} pending</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Review and approve or reject new user registration requests.
      </p>

      {pending.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
          <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No pending approvals</p>
          <p className="text-xs text-muted-foreground mt-1">All user registrations have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((u) => (
            <div key={u.id} className="bg-card rounded-xl border border-border p-5 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
                  {u.full_name?.[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />{u.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    Role: {u.role} · Registered {format(new Date(u.created_date), "dd MMM yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleApprove(u)}
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
          ))}
        </div>
      )}
    </div>
  );
}
