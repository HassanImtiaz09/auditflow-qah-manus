// UserManagement — tRPC backend
import { useState } from "react";
import { Input } from "@/components/ui/input";
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
import { Search, Users, UserSearch, LinkIcon, Unlink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  admin:      { label: "Admin",      bg: "bg-purple-100", text: "text-purple-800" },
  consultant: { label: "Consultant", bg: "bg-blue-100",   text: "text-blue-800" },
  clinician:  { label: "Clinician",  bg: "bg-slate-100",  text: "text-slate-600" },
};

type UserRow = {
  id: number;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  grade?: string | null;
  title?: string | null;
  auditRole: "clinician" | "consultant" | "admin";
  linkedConsultantId?: number | null;
  createdAt: Date;
};

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.all.useQuery();
  const { data: consultantList = [] } = trpc.audits.consultants.useQuery();
  const [search, setSearch] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupInput, setLookupInput] = useState("");
  const { data: lookupResults, isFetching: lookupLoading } = trpc.users.search.useQuery(
    { query: lookupQuery },
    { enabled: lookupQuery.length >= 2 }
  );

  // Re-link dialog state
  const [relinkTarget, setRelinkTarget] = useState<UserRow | null>(null);
  const [relinkValue, setRelinkValue] = useState<string>("");

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated.");
      utils.users.all.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const updateLinkedConsultantMutation = trpc.users.updateLinkedConsultant.useMutation({
    onSuccess: () => {
      toast.success(relinkValue === "__unlink__" ? "Consultant link removed." : "Consultant link updated.");
      utils.users.all.invalidate();
      setRelinkTarget(null);
      setRelinkValue("");
    },
    onError: err => toast.error(err.message),
  });

  function openRelinkDialog(u: UserRow) {
    setRelinkTarget(u);
    setRelinkValue(u.linkedConsultantId ? String(u.linkedConsultantId) : "");
  }

  function confirmRelink() {
    if (!relinkTarget) return;
    const newId = relinkValue === "__unlink__" || relinkValue === "" ? null : Number(relinkValue);
    updateLinkedConsultantMutation.mutate({ userId: relinkTarget.id, linkedConsultantId: newId });
  }

  function getConsultantName(id: number | null | undefined) {
    if (!id) return null;
    const c = consultantList.find(c => c.id === id);
    return c ? c.fullName : `#${id}`;
  }

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.fullName ?? u.name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.grade ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all registered users, their roles, and consultant linkages.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          {users.length} users
        </div>
      </div>

      {/* Account Lookup */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <UserSearch className="w-4 h-4" />Account Lookup
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Search for a user by name — useful when someone can't remember which email they registered with.</p>
        <div className="flex gap-2">
          <Input
            value={lookupInput}
            onChange={e => setLookupInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setLookupQuery(lookupInput)}
            placeholder="Type a name to search…"
            className="text-sm"
          />
          <Button variant="outline" onClick={() => setLookupQuery(lookupInput)} disabled={lookupInput.length < 2}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
        {lookupQuery.length >= 2 && (
          <div className="mt-3">
            {lookupLoading ? (
              <p className="text-xs text-muted-foreground">Searching…</p>
            ) : !lookupResults || lookupResults.length === 0 ? (
              <p className="text-xs text-muted-foreground">No users found matching "{lookupQuery}".</p>
            ) : (
              <div className="space-y-2">
                {lookupResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{u.fullName ?? u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email} · {u.grade ?? "—"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      ROLE_LABELS[u.auditRole ?? "clinician"]?.bg ?? "bg-slate-100"
                    } ${
                      ROLE_LABELS[u.auditRole ?? "clinician"]?.text ?? "text-slate-600"
                    }`}>
                      {ROLE_LABELS[u.auditRole ?? "clinician"]?.label ?? "Clinician"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="pl-9 text-sm" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No users found.</p>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Grade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Linked Consultant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(u => {
                const roleInfo = ROLE_LABELS[u.auditRole ?? "clinician"] ?? ROLE_LABELS.clinician;
                const linkedName = getConsultantName(u.linkedConsultantId);
                const isConsultant = u.auditRole === "consultant";
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.fullName ?? u.name}</p>
                      {u.title && <p className="text-xs text-muted-foreground">{u.title}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-xs">{u.grade ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${roleInfo.bg} ${roleInfo.text}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isConsultant ? (
                        <div className="flex items-center gap-2">
                          {linkedName ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                              <LinkIcon className="w-3 h-3" />{linkedName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not linked</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openRelinkDialog(u as UserRow)}
                          >
                            Change…
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.auditRole ?? "clinician"}
                        onChange={e => updateRoleMutation.mutate({ userId: u.id, auditRole: e.target.value as "admin" | "consultant" | "clinician" })}
                        className="px-2 py-1 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="clinician">Clinician</option>
                        <option value="consultant">Consultant</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Re-link dialog */}
      <Dialog open={!!relinkTarget} onOpenChange={(open) => { if (!open) { setRelinkTarget(null); setRelinkValue(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Change Linked Consultant
            </DialogTitle>
            <DialogDescription>
              Update which named consultant from the department list this account is linked to.
              Audits assigned to the selected consultant will be routed to this user's Approval Queue.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <p className="text-sm font-medium mb-1">
              Account: <span className="font-semibold">{relinkTarget?.fullName ?? relinkTarget?.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">{relinkTarget?.email}</p>

            <label className="text-sm font-medium block mb-1.5">Linked consultant name</label>
            <Select value={relinkValue} onValueChange={setRelinkValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select consultant name…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unlink__">
                  <span className="flex items-center gap-1.5 text-red-600">
                    <Unlink className="w-3.5 h-3.5" />Remove link (unlink)
                  </span>
                </SelectItem>
                {consultantList.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}{c.grade ? ` — ${c.grade}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRelinkTarget(null); setRelinkValue(""); }}
              disabled={updateLinkedConsultantMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={confirmRelink}
              disabled={updateLinkedConsultantMutation.isPending || !relinkValue}
            >
              {updateLinkedConsultantMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
