// AuditFlow QAH — Pending Approval Page
// Shown to consultant accounts that have logged in but are awaiting admin approval.
import { Clock, LogOut, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663430072618/436kjx9HnHs4DfQBN2oU96/auditflow-logo-EjJ5FaZLtyvkjMQHAcbGWR.webp";

export default function PendingApproval() {
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      utils.auth.currentUser.invalidate();
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={LOGO_URL}
            alt="AuditFlow QAH"
            className="w-14 h-14 rounded-2xl shadow-md mb-3"
          />
          <p className="text-sm font-semibold text-foreground">AuditFlow ENT</p>
          <p className="text-xs text-muted-foreground">QAH Audit Registry</p>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>

          <h1 className="text-xl font-semibold text-foreground mb-2">
            Account Pending Approval
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Your consultant account has been registered and is awaiting review by the department administrator. You will be able to access the full system once your account is approved.
          </p>

          {/* What happens next */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-6 text-left space-y-2.5">
            <p className="text-xs font-semibold text-amber-800 mb-1">What happens next?</p>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                The administrator has been notified and will review your registration shortly.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Once approved, you will have full access to the Approval Queue and all consultant features.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Portsmouth Hospitals University NHS Trust · ENT Department
        </p>
      </div>
    </div>
  );
}
