// ForgotPassword - Request a password reset link via email
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email, origin: window.location.origin });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your registered email address and we will send you a reset link.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Recovery</CardTitle>
            <CardDescription>
              A password reset link will be sent to your registered email address. The link expires
              in <strong>1 hour</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@nhs.net"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={requestReset.isPending}
                >
                  {requestReset.isPending ? "Sending…" : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    If an account with that email address exists, a password reset link has been
                    sent. Please check your inbox (and spam folder) — the link expires in{" "}
                    <strong>1 hour</strong>.
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSubmitted(false); setEmail(""); }}
                >
                  Try another email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/login">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
