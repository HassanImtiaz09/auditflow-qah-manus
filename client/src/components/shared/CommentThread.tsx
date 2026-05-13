/**
 * CommentThread — Q&A thread for a single audit.
 *
 * Access rules (mirroring the backend):
 *   - Visible and postable only by the audit's submitter, assigned supervisor, or an admin.
 *   - Any other authenticated user sees nothing (the component renders null).
 *
 * The component receives the full current user object so it can:
 *   1. Gate rendering without an extra network round-trip.
 *   2. Use the real role/name in optimistic comment previews.
 */
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Send, User } from "lucide-react";

interface CurrentUser {
  id: number;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  auditRole?: string | null;
}

interface Props {
  auditId: number;
  /** id of the audit's submitter — used to determine access */
  submittedById?: number | null;
  /** id of the audit's assigned supervisor — used to determine access */
  supervisorId?: number | null;
  /** Full current user object — used for access gating and optimistic updates */
  currentUser?: CurrentUser | null;
}

const ROLE_BADGE: Record<string, string> = {
  clinician:  "bg-blue-50 text-blue-700 border-blue-200",
  consultant: "bg-purple-50 text-purple-700 border-purple-200",
  admin:      "bg-amber-50 text-amber-700 border-amber-200",
};

const ROLE_LABEL: Record<string, string> = {
  clinician:  "Clinician",
  consultant: "Consultant",
  admin:      "Admin",
};

export default function CommentThread({ auditId, submittedById, supervisorId, currentUser }: Props) {
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Access gate ──────────────────────────────────────────────────────────────
  const isAllowed =
    !!currentUser &&
    (currentUser.auditRole === "admin" ||
      currentUser.id === submittedById ||
      currentUser.id === supervisorId);

  const { data: comments = [], isLoading, isError } = trpc.audits.comments.useQuery(
    { auditId },
    {
      enabled: isAllowed,
      refetchInterval: 30_000,
    }
  );

  const addComment = trpc.audits.addComment.useMutation({
    onMutate: async (vars) => {
      await utils.audits.comments.cancel({ auditId });
      const prev = utils.audits.comments.getData({ auditId });

      // Use the real user's name and role for the optimistic preview
      const optimisticRole =
        (currentUser?.auditRole as "clinician" | "consultant" | "admin" | undefined) ?? "clinician";
      const optimisticName =
        currentUser?.fullName ?? currentUser?.name ?? currentUser?.email ?? "You";

      utils.audits.comments.setData({ auditId }, (old) => [
        ...(old ?? []),
        {
          id: -Date.now(),
          auditId: vars.auditId,
          authorId: currentUser?.id ?? -1,
          authorName: optimisticName,
          authorRole: optimisticRole,
          body: vars.body,
          createdAt: new Date(),
        },
      ]);
      return { prev, draftBody: vars.body };
    },
    onError: (_err, _vars, ctx) => {
      // Restore previous comments
      utils.audits.comments.setData({ auditId }, ctx?.prev);
      // Restore the draft so the user doesn't lose their text
      if (ctx?.draftBody) setBody(ctx.draftBody);
      toast.error("Failed to post comment. Please try again.");
    },
    onSettled: () => {
      utils.audits.comments.invalidate({ auditId });
    },
  });

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  // Don't render anything for users who don't have access
  if (!isAllowed) return null;

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    addComment.mutate({ auditId, body: trimmed });
    setBody("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-muted/10 px-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Discussion Thread
        </span>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({comments.length} {comments.length === 1 ? "message" : "messages"})
          </span>
        )}
      </div>

      {/* Message list */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-4">
        {isLoading && (
          <p className="text-xs text-muted-foreground py-2">Loading messages…</p>
        )}
        {isError && (
          <p className="text-xs text-destructive py-2">
            Could not load messages. Please refresh and try again.
          </p>
        )}
        {!isLoading && !isError && comments.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 italic">
            No messages yet. Start the conversation below.
          </p>
        )}
        {comments.map((c) => {
          const isOwn = c.authorId === currentUser?.id;
          return (
            <div
              key={c.id}
              className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              {/* Bubble */}
              <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-foreground">
                    {isOwn ? "You" : c.authorName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      ROLE_BADGE[c.authorRole] ?? "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {ROLE_LABEL[c.authorRole] ?? c.authorRole}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isOwn
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-card-foreground rounded-tl-sm"
                  }`}
                >
                  {c.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Ctrl+Enter to send)"
          className="resize-none text-sm min-h-[60px] max-h-[120px]"
          maxLength={2000}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || addComment.isPending}
          className="h-9 px-3 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {body.length}/2000 · Ctrl+Enter to send
      </p>
    </div>
  );
}
