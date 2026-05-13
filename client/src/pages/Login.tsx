// AuditFlow QAH — Login Page
// Design: NHS Clinical Precision — clean card on off-white canvas, navy accents
// Simulates login by matching email against registered users (no password in demo)

import { useState } from "react";
import { useLocation } from "wouter";
import { ClipboardList, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getAllUsers, setCurrentUser } from "@/lib/store";

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingConsultant, setPendingConsultant] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    const users = getAllUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!found) {
      toast.error("No account found with that email. Please register first.");
      setSubmitting(false);
      return;
    }

    // Consultant awaiting role approval
    if (found.role === "consultant" && !found.role_approved) {
      setPendingConsultant(true);
      setSubmitting(false);
      return;
    }

    // Approved user — log in
    setCurrentUser(found);
    toast.success(`Welcome back, ${found.full_name}!`);
    onLogin();
    navigate("/");
    setSubmitting(false);
  };

  if (pendingConsultant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Awaiting Approval</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Your consultant account is pending administrator approval. You will be able to log in
              once the admin has confirmed your role.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPendingConsultant(false)}
            >
              Try a different account
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <LogIn className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">Sign In</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                NHS Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@porthosp.nhs.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the email address you registered with.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !email}
            >
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-primary font-medium hover:underline"
              >
                Register
              </button>
            </p>
          </div>
        </div>


      </div>
    </div>
  );
}
