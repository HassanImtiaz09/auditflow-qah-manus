// UserApprovals — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, User, ShieldCheck, Inbox, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

type PendingUser = {
  id: number;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  grade?: string | null;
  title?: string | null;
  auditRole: "clinician" | "consultant" | "admin";
  createdAt: Date;
};

export default function UserApprovals() {
  const utils = trpc.useUtils();
  const { data: pendingUsers = [], isLoading } = trpc.users.pending.useQuery();
  // Fetch the seeded consultant list for the picker
  const { data: consultantList = [] } = trpc.audits.consultants.useQuery();

  // Dialog state — which user is being approved as consultant
  const [consultantDialog, setConsultantDialog] = useState<PendingUser | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");

  const approveMutation = trpc.users.approve.useMutation({
    onSuccess: () => {
      toast.success("User approved successfully.");
      utils.users.pending.invalidate();
      utils.users.all.invalidate();
      setConsultantDialog(null);
      setSelectedConsultantId("");
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

  function handleApprove(u: PendingUser) {
    if (u.auditRole === "consultant") {
      // Open the consultant-link dialog first
      setConsultantDialog(u);
      setSelectedConsultantId("");
    } else {
      // Non-consultant: approve immediately without linking
      approveMutation.mutate({ userId: u.id });
    }
  }

  function handleConfirmConsultantApproval() {
    if (!consultantDialog) return;
    approveMutation.mutate({
      userId: consultantDialog.id,
      linkedConsultantId: selectedConsultantId ? Number(selectedConsultantId) : null,
    });
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">User Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve new user registrations. When approving a consultant, you will be asked
          to link their account to a named consultant from the department list.
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
                  Approving this user grants them access to the{" "}
                  <strong>Approval Queue</strong>. You will be asked to link their account to a
                  named consultant so audits assigned to that consultant are routed correctly.
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleApprove(u as PendingUser)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {u.auditRole === "consultant" ? "Approve & Link…" : "Approve"}
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

      {/* Consultant-link dialog */}
      <Dialog open={!!consultantDialog} onOpenChange={(open) => { if (!open) { setConsultantDialog(null); setSelectedConsultantId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-purple-600" />
              Link Consultant Account
            </DialogTitle>
            <DialogDescription>
              Select which named consultant from the department list this account belongs to.
              Audits submitted with that consultant selected will be routed to this user for approval.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <p className="text-sm font-medium mb-1">
              Approving: <span className="text-foreground font-semibold">{consultantDialog?.fullName ?? consultantDialog?.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">{consultantDialog?.email}</p>

            <label className="text-sm font-medium block mb-1.5">
              Link to consultant name <span className="text-muted-foreground font-normal">(required)</span>
            </label>
            <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select consultant name…" />
              </SelectTrigger>
              <SelectContent>
                {consultantList.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}{c.grade ? ` — ${c.grade}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {consultantList.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                No consultant names found in the system. You can still approve without linking.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setConsultantDialog(null); setSelectedConsultantId(""); }}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmConsultantApproval}
              disabled={approveMutation.isPending || !selectedConsultantId}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {approveMutation.isPending ? "Approving…" : "Confirm & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
