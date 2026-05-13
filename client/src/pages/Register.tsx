// AuditFlow QAH — Registration Page
// Design: NHS Clinical Precision — clean card on off-white canvas, navy accents
// Captures: full name, grade/role (from GRADES list), NHS email
// Consultant grades → pending admin approval; all others → auto-approved

import { useState } from "react";
import { useLocation } from "wouter";
import { ClipboardList, UserPlus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
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
import { registerUser, getAllUsers, setCurrentUser } from "@/lib/store";

const CONSULTANT_GRADES = ["Consultant", "Associate Specialist"];

interface Props {
  onRegistered: () => void;
}

export default function Register({ onRegistered }: Props) {
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState<"clinician" | "consultant_pending" | null>(null);

  const isConsultantGrade = CONSULTANT_GRADES.includes(grade);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !grade) {
      toast.error("Please complete all fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    // Check for duplicate email
    const existing = getAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      toast.error("An account with this email already exists.");
      return;
    }

    setSubmitting(true);
    try {
      const newUser = registerUser({ full_name: fullName.trim(), email: email.trim(), grade });

      if (isConsultantGrade) {
        setRegistered("consultant_pending");
      } else {
        // Auto-approved clinician — log them in immediately
        setCurrentUser(newUser);
        setRegistered("clinician");
        toast.success("Account created! Welcome to AuditFlow.");
        setTimeout(() => {
          onRegistered();
          navigate("/");
        }, 2000);
      }
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginInstead = () => {
    navigate("/login");
  };

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
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">AuditFlow ENT</h1>
          <p className="text-sm text-muted-foreground">QAH Audit Registry · Portsmouth Hospitals NHS Trust</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">Create Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="e.g. Dr. Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* NHS Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                NHS Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@porthosp.nhs.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Grade / Role */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Grade / Role <span className="text-destructive">*</span>
              </Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your grade or role" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Consultant notice */}
              {isConsultantGrade && (
                <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Consultant accounts require admin approval before you can access the approval queue. You will be notified once approved.
                  </p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !fullName || !email || !grade}
            >
              {submitting ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={handleLoginInstead}
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
