// UserApprovals — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CheckCircle2, XCircle, User, ShieldCheck, Inbox, LinkIcon, PlusCircle } from "lucide-react";
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
  // Fetch the seeded consultant roster from the consultantNames table
  const { data: consultantList = [], refetch: refetchConsultants } = trpc.audits.consultants.useQuery();

  // Dialog state — which user is being approved as consultant
  const [consultantDialog, setConsultantDialog] = useState<PendingUser | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");

  // Manual entry state
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualGrade, setManualGrade] = useState("");
  const [addingName, setAddingName] = useState(false);

  const addConsultantNameMutation = trpc.audits.addConsultantName.useMutation({
    onSuccess: async () => {
      await refetchConsultants();
    },
  });

  const approveMutation = trpc.users.approve.useMutation({
    onSuccess: () => {
      toast.success("User approved successfully.");
      utils.users.pending.invalidate();
      utils.users.pendingCount.invalidate();
      utils.users.all.invalidate();
      setConsultantDialog(null);
      setSelectedConsultantId("");
      setManualMode(false);
      setManualName("");
      setManualGrade("");
    },
    onError: err => toast.error(err.message),
  });

  const rejectMutation = trpc.users.reject.useMutation({
    onSuccess: () => {
      toast.success("User rejected.");
      utils.users.pending.invalidate();
      utils.users.pendingCount.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  function handleApprove(u: PendingUser) {
    if (u.auditRole === "consultant") {
      setConsultantDialog(u);
      setSelectedConsultantId("");
      setManualMode(false);
      setManualName("");
      setManualGrade("");
    } else {
      approveMutation.mutate({ userId: u.id });
    }
  }

  async function handleConfirmConsultantApproval() {
    if (!consultantDialog) return;

    if (manualMode) {
      // Add the new name to the roster first, then approve
      if (!manualName.trim()) {
        toast.error("Please enter a consultant name.");
        return;
      }
      setAddingName(true);
      try {
        const result = await addConsultantNameMutation.mutateAsync({
          fullName: manualName.trim(),
          grade: manualGrade.trim() || undefined,
        });
        // After adding, we need the new id — refetch and find it
        const refreshed = await refetchConsultants();
        const newEntry = refreshed.data?.find(c => c.displayName === manualName.trim());
        approveMutation.mutate({
          userId: consultantDialog.id,
          linkedConsultantId: newEntry ? newEntry.id : null,
        });
      } catch {
        toast.error("Failed to add consultant name. Please try again.");
      } finally {
        setAddingName(false);
      }
    } else {
      // Approve with selected (or no) link
      approveMutation.mutate({
        userId: consultantDialog.id,
        linkedConsultantId: selectedConsultantId ? Number(selectedConsultantId) : null,
      });
    }
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">User Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve new user registrations. When approving a consultant, link their account
          to a named consultant from the department list so audits are routed correctly.
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
      <Dialog open={!!consultantDialog} onOpenChange={(open) => {
        if (!open) {
          setConsultantDialog(null);
          setSelectedConsultantId("");
          setManualMode(false);
          setManualName("");
          setManualGrade("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-purple-600" />
              Link Consultant Account
            </DialogTitle>
            <DialogDescription>
              Select the consultant name from the department list, or enter a name manually if not
              listed. You can also approve without linking.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div>
              <p className="text-sm font-medium">
                Approving: <span className="text-foreground font-semibold">{consultantDialog?.fullName ?? consultantDialog?.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">{consultantDialog?.email}</p>
            </div>

            {!manualMode ? (
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Link to consultant name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select consultant name…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {consultantList.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.fullName}{c.grade ? ` — ${c.grade.replace(/^Consultant\s*[—\-]\s*/i, "")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  onClick={() => { setManualMode(true); setSelectedConsultantId(""); }}
                >
                  <PlusCircle className="w-3 h-3" />
                  Name not on list? Enter manually
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Consultant full name <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="e.g. John Smith"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Specialty / Grade <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    placeholder="e.g. Consultant — Rhinology"
                    value={manualGrade}
                    onChange={e => setManualGrade(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This name will be added to the department consultant list and will appear in the audit submission dropdown.
                </p>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setManualMode(false); setManualName(""); setManualGrade(""); }}
                >
                  ← Back to dropdown
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setConsultantDialog(null); setSelectedConsultantId(""); setManualMode(false); }}
              disabled={approveMutation.isPending || addingName}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmConsultantApproval}
              disabled={approveMutation.isPending || addingName || (manualMode && !manualName.trim())}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {approveMutation.isPending || addingName ? "Approving…" : "Confirm & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
