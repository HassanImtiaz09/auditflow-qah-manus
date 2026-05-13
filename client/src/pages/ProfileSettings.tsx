/**
 * ProfileSettings — lets any authenticated user view and update their personal
 * details (full name, title, email, grade) and change their password.
 *
 * Design: two clean cards stacked vertically, consistent with the rest of the
 * NHS clinical precision theme (deep navy sidebar, cool off-white canvas).
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
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
import { User, Lock, Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { GRADES } from "@/lib/auditConstants";

const TITLES = ["Dr", "Mr", "Miss", "Mrs", "Ms", "Prof", "Other"];

// ─── Personal details form ────────────────────────────────────────────────────

interface ProfileForm {
  fullName: string;
  title: string;
  email: string;
  grade: string;
}

function PersonalDetailsCard() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading, error } = trpc.users.getProfile.useQuery();

  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    title: "",
    email: "",
    grade: "",
  });
  const [dirty, setDirty] = useState(false);

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? "",
        title: profile.title ?? "",
        email: profile.email ?? "",
        grade: profile.grade ?? "",
      });
      setDirty(false);
    }
  }, [profile]);

  const update = trpc.users.updateProfile.useMutation({
    onSuccess: (updated) => {
      utils.users.getProfile.setData(undefined, updated as typeof profile);
      toast.success("Profile updated successfully.");
      setDirty(false);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update profile. Please try again.");
    },
  });

  const set = (field: keyof ProfileForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email address is required.");
      return;
    }
    update.mutate({
      fullName: form.fullName.trim(),
      title: form.title || undefined,
      email: form.email.trim(),
      grade: form.grade || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <User className="w-5 h-5 text-destructive" />
          </div>
          <p className="text-sm font-medium text-foreground">Failed to load profile</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {error.message ?? "Unable to retrieve your profile details. Please try again."}
          </p>
          <button
            onClick={() => utils.users.getProfile.invalidate()}
            className="text-xs text-primary underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Personal Details</h2>
          <p className="text-xs text-muted-foreground">Update your name, email address, and clinical grade.</p>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-5">
        {/* Role badge — read-only */}
        {profile && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Account type:</span>
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
              profile.auditRole === "admin"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : profile.auditRole === "consultant"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {profile.auditRole === "admin"
                ? "Administrator"
                : profile.auditRole === "consultant"
                ? "Consultant"
                : "Clinician"}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Select value={form.title || "none"} onValueChange={(v) => set("title", v === "none" ? "" : v)}>
              <SelectTrigger className="text-[13px]">
                <SelectValue placeholder="Select title (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No title</SelectItem>
                {TITLES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label>
            <Input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Jane Smith"
              className="text-[13px]"
              maxLength={255}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">Email Address <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@porthosp.nhs.uk"
              className="text-[13px]"
              maxLength={320}
            />
          </div>

          {/* Grade */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">Clinical Grade</Label>
            <Select value={form.grade || "none"} onValueChange={(v) => set("grade", v === "none" ? "" : v)}>
              <SelectTrigger className="text-[13px]">
                <SelectValue placeholder="Select grade (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || update.isPending}
            className="gap-1.5"
          >
            {update.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Change password form ─────────────────────────────────────────────────────

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

function ChangePasswordCard() {
  const [form, setForm] = useState<PasswordForm>({ current: "", next: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [success, setSuccess] = useState(false);

  const changePassword = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      setForm({ current: "", next: "", confirm: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      toast.success("Password changed successfully.");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to change password. Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!form.current) { toast.error("Please enter your current password."); return; }
    if (form.next.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (form.next !== form.confirm) { toast.error("New passwords do not match."); return; }
    changePassword.mutate({ currentPassword: form.current, newPassword: form.next });
  };

  const set = (field: keyof PasswordForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (success) setSuccess(false);
  };

  // Password strength indicator
  const strength = (() => {
    const p = form.next;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/5" };
    if (score <= 2) return { label: "Fair", color: "bg-amber-500", width: "w-2/5" };
    if (score <= 3) return { label: "Good", color: "bg-blue-500", width: "w-3/5" };
    if (score <= 4) return { label: "Strong", color: "bg-emerald-500", width: "w-4/5" };
    return { label: "Very strong", color: "bg-emerald-600", width: "w-full" };
  })();

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
          <p className="text-xs text-muted-foreground">Choose a strong password of at least 8 characters.</p>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-4">
        {success && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Password changed successfully.
          </div>
        )}

        {/* Current password */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Current Password</Label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={form.current}
              onChange={(e) => set("current", e.target.value)}
              placeholder="Enter current password"
              className="text-[13px] pr-9"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">New Password</Label>
          <div className="relative">
            <Input
              type={showNext ? "text" : "password"}
              value={form.next}
              onChange={(e) => set("next", e.target.value)}
              placeholder="At least 8 characters"
              className="text-[13px] pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNext((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength bar */}
          {strength && (
            <div className="space-y-1">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{strength.label}</p>
            </div>
          )}
        </div>

        {/* Confirm new password */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Confirm New Password</Label>
          <Input
            type="password"
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
            placeholder="Repeat new password"
            className={`text-[13px] ${
              form.confirm && form.next !== form.confirm
                ? "border-destructive focus-visible:ring-destructive"
                : ""
            }`}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          {form.confirm && form.next !== form.confirm && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!form.current || !form.next || !form.confirm || changePassword.isPending}
            className="gap-1.5"
          >
            {changePassword.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfileSettings() {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your personal details and account security.
        </p>
      </div>

      <PersonalDetailsCard />
      <ChangePasswordCard />
    </div>
  );
}
