// AuditFlow QAH - Login Page
import { useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663430072618/436kjx9HnHs4DfQBN2oU96/auditflow-logo-EjJ5FaZLtyvkjMQHAcbGWR.webp";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      utils.auth.currentUser.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12"
        style={{ background: "oklch(0.19 0.04 255)" }}
      >
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="AuditFlow QAH" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="text-white font-semibold text-sm leading-tight">AuditFlow ENT</p>
            <p className="text-white/50 text-[11px] leading-tight">QAH Audit Registry</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug">
              Clinical Audit<br />Management System
            </h2>
            <p className="mt-3 text-white/60 text-sm leading-relaxed max-w-xs">
              Streamline your ENT department's audit cycle — from registration and data collection through to consultant approval and outcome reporting.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {["Audit Registration", "Consultant Review", "NICE Standards", "Outcome Tracking"].map(f => (
              <span key={f} className="px-3 py-1 rounded-full text-[11px] font-medium text-white/70 border border-white/15 bg-white/5">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Trust footer */}
        <div className="border-t border-white/10 pt-6">
          <p className="text-white/40 text-[11px]">Portsmouth Hospitals University NHS Trust</p>
          <p className="text-white/25 text-[10px] mt-0.5">Queen Alexandra Hospital · ENT Department</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo (only shown on small screens) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img src={LOGO_URL} alt="AuditFlow QAH" className="w-14 h-14 rounded-2xl shadow-md mb-3" />
            <h1 className="text-lg font-semibold text-foreground">AuditFlow ENT</h1>
            <p className="text-xs text-muted-foreground">QAH Audit Registry · Portsmouth Hospitals NHS Trust</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to access the audit registry.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
            <h2 className="text-base font-semibold text-foreground mb-0.5 lg:hidden">Sign in</h2>
            <p className="text-sm text-muted-foreground mb-6 lg:hidden">Enter your registered NHS email and password.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">NHS Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@porthosp.nhs.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            For technical support contact your department IT lead.
          </p>
        </div>
      </div>
    </div>
  );
}
