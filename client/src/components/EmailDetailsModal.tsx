import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, AlertCircle, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface EmailDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: {
    id: number;
    subject: string;
    recipientEmail: string;
    recipientName?: string | null;
    emailType: string;
    body?: string | null;
    status: string;
    errorMessage?: string | null;
    sentAt: Date | string;
    auditRefNumber?: string | null;
    auditTopic?: string | null;
  } | null;
}

/**
 * Modal for viewing full email details including subject, body, recipient, and status.
 */
export function EmailDetailsModal({
  isOpen,
  onClose,
  email,
}: EmailDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!email) return null;

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
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-amber-600" />;
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

  const handleCopyBody = () => {
    if (email.body) {
      navigator.clipboard.writeText(email.body);
      setCopied(true);
      toast.success("Email content copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(email.subject);
    setCopied(true);
    toast.success("Subject copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold break-words">
                {email.subject}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Email notification details
              </DialogDescription>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border">
            {/* Recipient */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Recipient
              </p>
              <div className="space-y-1">
                {email.recipientName && (
                  <p className="text-sm font-medium">{email.recipientName}</p>
                )}
                <p className="text-sm text-muted-foreground break-all">
                  {email.recipientEmail}
                </p>
              </div>
            </div>

            {/* Email Type & Status */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Type
                </p>
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                  {getEmailTypeLabel(email.emailType)}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  {getStatusIcon(email.status)}
                  <Badge
                    variant="outline"
                    className={`border ${getStatusColor(email.status)}`}
                  >
                    {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Reference (if available) */}
          {email.auditRefNumber && (
            <div className="pb-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Audit Reference
              </p>
              <div className="space-y-1">
                <p className="text-sm font-mono font-semibold text-foreground">
                  {email.auditRefNumber}
                </p>
                {email.auditTopic && (
                  <p className="text-sm text-muted-foreground">{email.auditTopic}</p>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="pb-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Sent
            </p>
            <p className="text-sm text-foreground">
              {format(new Date(email.sentAt), "PPpp")}
            </p>
          </div>

          {/* Subject */}
          <div className="pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Subject
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopySubject}
                className="h-6 px-2 text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="bg-muted/50 rounded-md p-3 border border-border">
              <p className="text-sm text-foreground break-words font-medium">
                {email.subject}
              </p>
            </div>
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email Content
              </p>
              {email.body && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyBody}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>

            {email.body ? (
              <div className="bg-muted/50 rounded-md p-4 border border-border max-h-96 overflow-y-auto">
                <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {/* If body contains HTML, render as plain text for safety */}
                  {email.body.includes("<") && email.body.includes(">") ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: email.body,
                      }}
                    />
                  ) : (
                    email.body
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md p-4 border border-border text-center text-sm text-muted-foreground">
                No email content available
              </div>
            )}
          </div>

          {/* Error Message (if failed) */}
          {email.status === "failed" && email.errorMessage && (
            <div className="bg-red-50 rounded-md p-4 border border-red-200">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">
                Error Details
              </p>
              <p className="text-sm text-red-700 break-words">{email.errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
