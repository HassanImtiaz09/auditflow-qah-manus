// SettingsPage — Department settings + invite users (consultant-only)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, UserPlus, Settings } from "lucide-react";
import { getSettings, updateSettings, addUser, type AppUser } from "@/lib/store";

interface Props {
  user: AppUser;
}

const SETTING_FIELDS = [
  { key: "dept",   label: "Department Name" },
  { key: "hosp",   label: "Hospital" },
  { key: "trust",  label: "Trust" },
  { key: "prefix", label: "Serial Number Prefix" },
] as const;

export default function SettingsPage({ user }: Props) {
  const settings = getSettings();
  const [formValues, setFormValues] = useState<Record<string, string>>({ ...settings });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"clinician" | "consultant">("clinician");
  const [inviteName, setInviteName] = useState("");

  const isConsultant = user.role === "consultant" || user.role === "admin";

  if (!isConsultant) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <Settings className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">Consultant access required</p>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    updateSettings(formValues);
    toast.success("Settings saved");
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return toast.error("Please enter an email address");
    if (!inviteName.trim()) return toast.error("Please enter a name");
    addUser({
      full_name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      approved: true,
    });
    toast.success(`User ${inviteName.trim()} added`);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("clinician");
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Settings</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Configure department settings and manage user accounts.
      </p>

      {/* Department settings */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold mb-4">Department Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SETTING_FIELDS.map((field) => (
            <div key={field.key}>
              <Label className="text-xs font-medium">{field.label}</Label>
              <Input
                value={formValues[field.key] || ""}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="mt-1 text-[13px]"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={handleSave} size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save Settings
          </Button>
        </div>
      </div>

      {/* Invite user */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Add User</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-xs font-medium">Full Name</Label>
            <Input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 text-[13px]"
              placeholder="Dr. Jane Smith"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Email Address</Label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 text-[13px]"
              placeholder="j.smith@porthosp.nhs.uk"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Role</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "clinician" | "consultant")}>
              <SelectTrigger className="mt-1 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinician">Clinician</SelectItem>
                <SelectItem value="consultant">Consultant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleInvite} size="sm">
          <UserPlus className="w-4 h-4 mr-1" />
          Add User
        </Button>
      </div>
    </div>
  );
}
