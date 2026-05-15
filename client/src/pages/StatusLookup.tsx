/**
 * Public audit status lookup page — reachable at /status without authentication.
 *
 * Allows anyone with a reference number (e.g. REF-20250515-0001) to check the
 * current status of an audit without logging in. Only the safe public fields
 * (refNumber, status, decidedAt, category) are returned by the server.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Under Review",
  approved: "Approved",
  rejected: "Not Approved",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="w-4 h-4" />,
  pending: <Clock className="w-4 h-4" />,
  approved: <CheckCircle2 className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatusLookup() {
  const [ref, setRef] = useState("");
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const { data, error, isLoading, isFetching } = trpc.audits.publicStatus.useQuery(
    { ref: submittedRef ?? "" },
    {
      enabled: !!submittedRef,
      retry: false,
    }
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ref.trim().toUpperCase();
    if (!trimmed) return;
    setSubmittedRef(trimmed);
  }

  const loading = isLoading || isFetching;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">AuditFlow QAH</h1>
            <p className="text-xs text-muted-foreground">Audit Status Lookup</p>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-lg space-y-6">
          {/* Intro */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Check audit status</h2>
            <p className="text-muted-foreground text-sm">
              Enter your reference number to see the current status of your audit submission.
            </p>
          </div>

          {/* Search form */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  placeholder="e.g. REF-20250515-0001"
                  className="font-mono text-sm"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" disabled={!ref.trim() || loading} className="shrink-0 gap-1.5">
                  <Search className="w-4 h-4" />
                  {loading ? "Checking…" : "Check"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result card */}
          {submittedRef && !loading && (
            <>
              {error ? (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-6">
                    <p className="text-sm text-destructive font-medium">
                      {error.message === "No audit found with that reference number."
                        ? `No audit found for reference "${submittedRef}". Please check the reference number and try again.`
                        : "An error occurred. Please try again in a moment."}
                    </p>
                  </CardContent>
                </Card>
              ) : data ? (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-mono">{data.refNumber}</CardTitle>
                      <Badge
                        variant={STATUS_VARIANTS[data.status] ?? "outline"}
                        className="gap-1 shrink-0"
                      >
                        {STATUS_ICONS[data.status]}
                        {STATUS_LABELS[data.status] ?? data.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {data.category && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Category</span>
                        <span className="text-foreground font-medium">{data.category}</span>
                      </div>
                    )}
                    {data.decidedAt && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Decision date</span>
                        <span className="text-foreground font-medium">
                          {new Date(data.decidedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {data.status === "pending" && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        Your audit is currently under review. You will be notified by email when a decision is made.
                      </p>
                    )}
                    {data.status === "approved" && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        This audit has been approved. Sign in to view the full details and decision notes.
                      </p>
                    )}
                    {data.status === "rejected" && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        This audit was not approved at this time. Sign in to view the feedback and next steps.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}

          {/* Footer link */}
          <p className="text-center text-xs text-muted-foreground">
            Need to submit or manage audits?{" "}
            <Link href="/login" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Sign in to your account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
