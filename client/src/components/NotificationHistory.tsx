import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Mail, AlertCircle, CheckCircle, Clock, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmailDetailsModal } from "./EmailDetailsModal";

export interface NotificationHistoryProps {
  auditId?: number;
  supervisorMode?: boolean;
  limit?: number;
}

/**
 * Display email notification history for an audit or supervisor.
 * Shows all sent emails with status, recipient, type, and timestamp.
 */
export function NotificationHistory({
  auditId,
  supervisorMode = false,
  limit = 50,
}: NotificationHistoryProps) {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const utils = trpc.useUtils();

  // Fetch history based on mode
  const historyQuery = supervisorMode
    ? trpc.emailHistory.getSupervisorHistory.useQuery({ limit })
    : auditId
      ? trpc.emailHistory.getAuditHistory.useQuery({ auditId })
      : null;

  const statsQuery = supervisorMode
    ? trpc.emailHistory.getSupervisorStats.useQuery()
    : null;

  if (!historyQuery) return null;

  const { data: history, isLoading, error } = historyQuery;
  const { data: stats } = statsQuery || {};

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Failed to load notification history</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <Mail className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <p className="mt-2 text-sm text-muted-foreground">No emails sent yet</p>
      </div>
    );
  }

  const getEmailTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      submission: "Audit Submitted",
      status_change: "Status Changed",
      deadline_reminder_7day: "7-Day Reminder",
      deadline_reminder_1day: "1-Day Reminder",
      reassignment: "Reassigned",
      reaudit_reminder: "Re-Audit Reminder",
    };
    return labels[type] || type;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "sent":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "failed":
        return "bg-red-50 text-red-800 border-red-200";
      case "pending":
        return "bg-amber-50 text-amber-800 border-amber-200";
      default:
        return "bg-gray-50 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats header for supervisor mode */}
      {supervisorMode && stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">Total Sent</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">Successful</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.sent}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">By Type</p>
            <p className="text-sm font-semibold">
              {Object.keys(stats.byType).length} types
            </p>
          </div>
        </div>
      )}

      {/* Email history table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Recipient</th>
              {auditId && <th className="px-4 py-3 text-left font-semibold">Audit</th>}
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((email) => (
              <tr
                key={email.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedEmail(email);
                  setModalOpen(true);
                }}
              >
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                  {format(new Date(email.sentAt), "MMM d, yyyy HH:mm")}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Mail className="h-3 w-3" />
                    {getEmailTypeLabel(email.emailType)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{email.recipientName || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{email.recipientEmail}</p>
                  </div>
                </td>
                {auditId && (
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono text-xs font-semibold">
                        {email.auditRefNumber}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {email.auditTopic}
                      </p>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(email.status)}
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(email.status)}`}
                    >
                      {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmail(email);
                        setModalOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {email.errorMessage && (
                    <p className="text-xs text-red-600 mt-1">{email.errorMessage}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination hint */}
      {history.length >= limit && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {limit} most recent emails. Older emails are archived.
        </p>
      )}

      {/* Email Details Modal */}
      <EmailDetailsModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEmail(null);
        }}
        email={selectedEmail}
      />
    </div>
  );
}
