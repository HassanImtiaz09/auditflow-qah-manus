// UserManagement — Admin-only role management
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Search, Mail } from "lucide-react";
import { format } from "date-fns";
import {
  getAllUsers,
  updateUserRole,
  type AppUser,
} from "@/lib/store";

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  admin:      { label: "Admin",      bg: "bg-purple-100", text: "text-purple-800" },
  consultant: { label: "Consultant", bg: "bg-blue-100",   text: "text-blue-800" },
  clinician:  { label: "Clinician",  bg: "bg-slate-100",  text: "text-slate-600" },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_LABELS[role] || ROLE_LABELS.clinician;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

interface Props {
  user: AppUser;
  onRefresh: () => void;
}

export default function UserManagement({ user, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Only show users who are fully approved (approved=true AND if consultant, role_approved=true)
  const users = getAllUsers().filter((u) => u.approved && (u.role !== "consultant" || u.role_approved));

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      !term ||
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    );
  });

  const handleRoleChange = (userId: string, newRole: AppUser["role"]) => {
    if (userId === user.id) {
      toast.error("You cannot change your own role.");
      return;
    }
    setUpdatingId(userId);
    updateUserRole(userId, newRole);
    const updated = users.find((u) => u.id === userId);
    toast.success(`${updated?.full_name || "User"}'s role updated to ${newRole}`);
    setUpdatingId(null);
    forceUpdate((n) => n + 1);
    onRefresh();
  };

  if (user.role !== "admin") {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Users className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-xl font-bold text-foreground mb-1">User Management</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Manage user roles across the department.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="pl-9 text-[13px]"
        />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Grade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Current Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                        {u.full_name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{u.full_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />{u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.grade || "—"}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(u.created_date), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    {u.id === user.id ? (
                      <span className="text-[11px] text-muted-foreground italic">You</span>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleRoleChange(u.id, v as AppUser["role"])}
                        disabled={updatingId === u.id}
                      >
                        <SelectTrigger className="w-[130px] text-[12px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinician">Clinician</SelectItem>
                          <SelectItem value="consultant">Consultant</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
