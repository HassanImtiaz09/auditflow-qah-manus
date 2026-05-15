/**
 * ConsultantRoster — Admin page for managing the consultant names roster.
 * Supports: add, edit, deactivate/reactivate, and link to user accounts.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, UserX, UserCheck, Link2, Loader2, Users } from "lucide-react";

type RosterEntry = {
  id: number;
  title: string | null;
  fullName: string;
  grade: string | null;
  active: boolean;
  createdAt: Date;
};

type UserEntry = {
  id: number;
  name: string;
  email: string;
  auditRole: string;
  linkedConsultantId: number | null;
};

export default function ConsultantRoster() {
  const utils = trpc.useUtils();

  const { data: roster = [], isLoading } = trpc.audits.rosterAll.useQuery();
  const { data: allUsers = [] } = trpc.users.all.useQuery();

  // Consultant users with their linked roster IDs
  const consultantUsers = (allUsers as UserEntry[]).filter(u => u.auditRole === "consultant");

  // ── Add dialog state ──────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", fullName: "", grade: "" });

  // ── Edit dialog state ─────────────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<RosterEntry | null>(null);
  const [editForm, setEditForm] = useState({ title: "", fullName: "", grade: "" });

  // ── Link dialog state ─────────────────────────────────────────────────────
  const [linkEntry, setLinkEntry] = useState<RosterEntry | null>(null);
  const [linkUserId, setLinkUserId] = useState<string>("");

  // ── Show inactive toggle ──────────────────────────────────────────────────
  const [showInactive, setShowInactive] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addMutation = trpc.audits.addConsultantName.useMutation({
    onSuccess: () => {
      toast.success("Consultant added to roster.");
      utils.audits.rosterAll.invalidate();
      utils.audits.consultants.invalidate();
      setAddOpen(false);
      setAddForm({ title: "", fullName: "", grade: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.audits.rosterUpdate.useMutation({
    onSuccess: () => {
      toast.success("Roster entry updated.");
      utils.audits.rosterAll.invalidate();
      utils.audits.consultants.invalidate();
      setEditEntry(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.audits.rosterDeactivate.useMutation({
    onSuccess: () => {
      toast.success("Entry deactivated.");
      utils.audits.rosterAll.invalidate();
      utils.audits.consultants.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reactivateMutation = trpc.audits.rosterReactivate.useMutation({
    onSuccess: () => {
      toast.success("Entry reactivated.");
      utils.audits.rosterAll.invalidate();
      utils.audits.consultants.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const linkMutation = trpc.users.updateLinkedConsultant.useMutation({
    onSuccess: () => {
      toast.success("User linked to roster entry.");
      utils.users.all.invalidate();
      setLinkEntry(null);
      setLinkUserId("");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openEdit = (entry: RosterEntry) => {
    setEditEntry(entry);
    setEditForm({
      title: entry.title ?? "",
      fullName: entry.fullName,
      grade: entry.grade ?? "",
    });
  };

  const openLink = (entry: RosterEntry) => {
    setLinkEntry(entry);
    const linked = consultantUsers.find(u => u.linkedConsultantId === entry.id);
    setLinkUserId(linked ? String(linked.id) : "");
  };

  const getLinkedUser = (entryId: number) =>
    consultantUsers.find(u => u.linkedConsultantId === entryId);

  const visibleRoster = (roster as RosterEntry[]).filter(e => showInactive || e.active);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />Loading roster…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Consultant Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the list of consultants available for audit supervision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(v => !v)}
            className="text-xs"
          >
            {showInactive ? "Hide Inactive" : "Show Inactive"}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Add Consultant
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-5 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{(roster as RosterEntry[]).filter(e => e.active).length}</strong> active</span>
        <span><strong className="text-foreground">{(roster as RosterEntry[]).filter(e => !e.active).length}</strong> inactive</span>
        <span><strong className="text-foreground">{consultantUsers.filter(u => u.linkedConsultantId).length}</strong> linked to accounts</span>
      </div>

      {/* Roster table */}
      {visibleRoster.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No consultants in roster</p>
          <p className="text-xs text-muted-foreground mt-1">Add the first consultant using the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRoster.map((entry) => {
            const linked = getLinkedUser(entry.id);
            return (
              <div
                key={entry.id}
                className={`bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4 ${!entry.active ? "opacity-60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {entry.title ? `${entry.title} ` : ""}{entry.fullName}
                    </p>
                    {!entry.active && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Inactive</Badge>
                    )}
                    {linked && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-blue-700 border-blue-200 bg-blue-50">
                        <Link2 className="w-2.5 h-2.5 mr-1" />{linked.name}
                      </Badge>
                    )}
                  </div>
                  {entry.grade && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.grade}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Edit"
                    onClick={() => openEdit(entry)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Link to user account"
                    onClick={() => openLink(entry)}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </Button>
                  {entry.active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      title="Deactivate"
                      onClick={() => deactivateMutation.mutate({ id: entry.id })}
                      disabled={deactivateMutation.isPending}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      title="Reactivate"
                      onClick={() => reactivateMutation.mutate({ id: entry.id })}
                      disabled={reactivateMutation.isPending}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Consultant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Dr"
                  className="mt-1 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={addForm.fullName}
                  onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Jane Smith"
                  className="mt-1 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Grade / Specialty</Label>
              <Input
                value={addForm.grade}
                onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))}
                placeholder="Consultant — Head and Neck"
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate({
                title: addForm.title || undefined,
                fullName: addForm.fullName,
                grade: addForm.grade || undefined,
              })}
              disabled={!addForm.fullName.trim() || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Add Consultant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editEntry} onOpenChange={v => !v && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Consultant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Dr"
                  className="mt-1 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.fullName}
                  onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Grade / Specialty</Label>
              <Input
                value={editForm.grade}
                onChange={e => setEditForm(f => ({ ...f, grade: e.target.value }))}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button
              onClick={() => editEntry && updateMutation.mutate({
                id: editEntry.id,
                title: editForm.title || undefined,
                fullName: editForm.fullName,
                grade: editForm.grade || undefined,
              })}
              disabled={!editForm.fullName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={!!linkEntry} onOpenChange={v => !v && setLinkEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to User Account</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Link <strong>{linkEntry?.fullName}</strong> to a consultant user account so their queue is automatically populated.
            </p>
            <div>
              <Label className="text-xs">Consultant User Account</Label>
              <Select value={linkUserId} onValueChange={setLinkUserId}>
                <SelectTrigger className="mt-1 text-sm">
                  <SelectValue placeholder="Select a consultant user…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unlink —</SelectItem>
                  {consultantUsers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkEntry(null)}>Cancel</Button>
            <Button
              onClick={() => linkEntry && linkMutation.mutate({
                userId: Number(linkUserId),
                linkedConsultantId: linkEntry.id,
              })}
              disabled={!linkUserId || linkUserId === "none" || linkMutation.isPending}
            >
              {linkMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Link Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
