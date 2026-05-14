import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Redirect to login after 3 seconds
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (err: { message: string }) => {
      if (err.message.includes("expired")) {
        setStatus("expired");
      } else {
        setStatus("error");
        setErrorMsg(err.message);
      }
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    } else if (token === "") {
      setStatus("error");
      setErrorMsg("No verification token found in the link.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">AuditFlow QAH</span>
          </div>
          <p className="text-slate-400 text-sm">Portsmouth Hospitals University NHS Trust — ENT Department</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Verifying your email…</h1>
              <p className="text-slate-400 text-sm">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Email Verified!</h1>
              <p className="text-slate-300 text-sm mb-6">
                Your email address has been verified. You can now log in to AuditFlow QAH.
              </p>
              <p className="text-slate-500 text-xs mb-4">Redirecting to login in 3 seconds…</p>
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Go to Login
                </Button>
              </Link>
            </>
          )}

          {status === "expired" && (
            <>
              <XCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Link Expired</h1>
              <p className="text-slate-300 text-sm mb-6">
                This verification link has expired (links are valid for 24 hours). Please request a new one.
              </p>
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Back to Login
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Verification Failed</h1>
              <p className="text-slate-300 text-sm mb-2">
                {errorMsg || "The verification link is invalid or has already been used."}
              </p>
              <p className="text-slate-400 text-xs mb-6">
                If you believe this is an error, please try registering again or contact your department audit lead.
              </p>
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Back to Login
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
