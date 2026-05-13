// AuditFlow QAH — Register Page (tRPC + password auth)
import { useState } from "react";
import { Link } from "wouter";
import { UserPlus, CheckCircle2, Clock, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
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
import { GRADES } from "@/lib/auditConstants";
import { trpc } from "@/lib/trpc";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663430072618/436kjx9HnHs4DfQBN2oU96/auditflow-logo-EjJ5FaZLtyvkjMQHAcbGWR.webp";
const CONSULTANT_GRADES = ["Consultant", "Associate Specialist", "Specialty Doctor"];

export default function Register() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    title: "",
    grade: "",
    password: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [registered, setRegistered] = useState<"clinician" | "consultant_pending" | null>(null);

  const utils = trpc.useUtils();
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      if (data.pending) {
        setRegistered("consultant_pending");
      } else {
        utils.auth.me.invalidate();
        utils.auth.currentUser.invalidate();
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isConsultantGrade = CONSULTANT_GRADES.includes(form.grade);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    registerMutation.mutate({
      fullName: form.fullName,
      email: form.email,
      title: form.title,
      grade: form.grade,
      password: form.password,
    });
  };

  const handleLoginInstead = () => { window.location.href = '/login'; };

  // ── Success states ────────────────────────────────────────────────────────
  if (registered === "consultant_pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Registration Submitted</h2>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Your consultant account request has been sent to the department administrator for review.
              You will be notified once your role has been approved.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-800 mb-1">What happens next?</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>The admin will review your consultant registration</li>
                <li>Once approved, you can log in and access the approval queue</li>
                <li>You will be able to approve/reject audits assigned to you</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoginInstead}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (registered === "clinician") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Account Created!</h2>
            <p className="text-sm text-muted-foreground">
              Welcome to AuditFlow ENT QAH. Redirecting you to the dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="AuditFlow QAH" className="w-14 h-14 rounded-2xl shadow-md mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-foreground">AuditFlow ENT</h1>
          <p className="text-sm text-muted-foreground">QAH Audit Registry · Portsmouth Hospitals NHS Trust</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">Create Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <select
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select…</option>
                  {["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Smith"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">NHS Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@porthosp.nhs.uk"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Grade / Role</Label>
              <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your grade or role" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isConsultantGrade && (
                <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Consultant-grade accounts require admin approval before you can access the approval queue.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={form.password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
