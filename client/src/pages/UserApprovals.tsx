// UserApprovals — tRPC backend
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, User, ShieldCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

export default function UserApprovals() {
  const utils = trpc.useUtils();
  const { data: pendingUsers = [], isLoading } = trpc.users.pending.useQuery();

  const approveMutation = trpc.users.approve.useMutation({
    onSuccess: () => {
      toast.success("User approved.");
      utils.users.pending.invalidate();
      utils.users.all.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const rejectMutation = trpc.users.reject.useMutation({
    onSuccess: () => {
      toast.success("User rejected.");
      utils.users.pending.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">User Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve new user registrations. Consultants require approval before they can access the Approval Queue.
        </p>
      </div>
      {pendingUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No pending registrations</p>
          <p className="text-xs text-muted-foreground mt-1">All user accounts are up to date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map(u => (
            <div key={u.id} className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{u.fullName ?? u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                {u.auditRole === "consultant" && (
                  <span className="inline-flex items-center gap-1.5 text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-1 text-xs font-semibold">
                    <ShieldCheck className="w-3 h-3" />Consultant
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Grade / Role</span>
                  <p className="font-medium mt-0.5">{u.grade ?? "—"}</p>
                </div>
                {u.title && (
                  <div>
                    <span className="text-xs text-muted-foreground">Title</span>
                    <p className="font-medium mt-0.5">{u.title}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Registered</span>
                  <p className="font-medium mt-0.5">
                    {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy 'at' HH:mm") : "—"}
                  </p>
                </div>
              </div>
              {u.auditRole === "consultant" && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
                  <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" />
                  Approving this user grants them access to the <strong>Approval Queue</strong>, where they can approve or reject audits assigned to them as supervising consultant.
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => approveMutation.mutate({ userId: u.id })}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => rejectMutation.mutate({ userId: u.id })}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-1.5" />Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
