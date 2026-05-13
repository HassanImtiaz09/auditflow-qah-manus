// ForgotPassword - Request a password reset link
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Copy, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      if (data.token) {
        const link = `${window.location.origin}/reset-password?token=${data.token}`;
        setResetLink(link);
      } else {
        // User not found — show generic success to prevent enumeration
        setResetLink("NOT_FOUND");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email });
  };

  const copyLink = async () => {
    if (!resetLink || resetLink === "NOT_FOUND") return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Reset link copied to clipboard.");
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
            Enter your registered NHS email address. A reset link will be generated for you.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Recovery</CardTitle>
            <CardDescription>
              Because this is an NHS intranet tool, reset links are generated on-screen and can be
              shared securely by an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!resetLink ? (
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
                  {requestReset.isPending ? "Generating link…" : "Generate Reset Link"}
                </Button>
              </form>
            ) : resetLink === "NOT_FOUND" ? (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    If an account with that email exists, a reset link has been generated. Please
                    contact your system administrator.
                  </AlertDescription>
                </Alert>
                <Button variant="outline" className="w-full" onClick={() => setResetLink(null)}>
                  Try another email
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    Reset link generated. Copy it below and share it securely with the user. The
                    link expires in <strong>1 hour</strong>.
                  </AlertDescription>
                </Alert>

                <div className="space-y-1.5">
                  <Label>Reset Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={resetLink}
                      className="font-mono text-xs bg-muted"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyLink}
                      className="flex-shrink-0"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click the link field to select all, then copy.
                  </p>
                </div>

                <Button variant="outline" className="w-full" onClick={() => { setResetLink(null); setEmail(""); }}>
                  Generate another link
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
