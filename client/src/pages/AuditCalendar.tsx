// AuditCalendar — tRPC backend
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import PriorityBadge from "@/components/shared/PriorityBadge";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, addMonths, subMonths, getDay,
} from "date-fns";
import { trpc } from "@/lib/trpc";

const PRIORITY_DOT: Record<string, string> = {
  Urgent:   "bg-red-500",
  High:     "bg-amber-500",
  Standard: "bg-blue-500",
  Routine:  "bg-emerald-500",
};

export default function AuditCalendar() {
  const { data: audits = [], isLoading } = trpc.audits.list.useQuery();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  type Audit = (typeof audits)[number];

  const getAuditDate = (a: Audit) => {
    if (a.status === "approved" && a.decidedAt) return new Date(a.decidedAt);
    return a.submittedAt ? new Date(a.submittedAt) : new Date(a.createdAt);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = (getDay(monthStart) + 6) % 7;

  const getAuditsForDay = (day: Date) =>
    audits.filter(a => isSameDay(getAuditDate(a), day));

  const today = new Date();
  const monthAudits   = audits.filter(a => isSameMonth(getAuditDate(a), currentMonth));
  const pendingMonth  = monthAudits.filter(a => a.status === "pending");
  const approvedMonth = monthAudits.filter(a => a.status === "approved");

  const dayAudits = selectedDay ? getAuditsForDay(selectedDay) : [];
  const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Audit Calendar</h2>
      <p className="text-sm text-muted-foreground mb-5">Visual overview of audit activity by date.</p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Total this month</p>
          <p className="text-2xl font-bold text-foreground mt-1">{monthAudits.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-amber-700">Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingMonth.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-emerald-700">Approved</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{approvedMonth.length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-semibold text-foreground">{format(currentMonth, "MMMM yyyy")}</h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="border-b border-r border-border min-h-[80px] bg-muted/10" />
          ))}
          {days.map((day, idx) => {
            const dayAuditList = getAuditsForDay(day);
            const isToday = isSameDay(day, today);
            const col = (startPad + idx) % 7;
            return (
              <div
                key={day.toISOString()}
                onClick={() => dayAuditList.length > 0 && setSelectedDay(day)}
                className={`border-b border-r border-border min-h-[80px] p-1.5 transition-colors ${
                  dayAuditList.length > 0 ? "cursor-pointer hover:bg-blue-50/50" : ""
                } ${isToday ? "bg-blue-50" : ""} ${col === 6 ? "border-r-0" : ""}`}
              >
                <p className={`text-[11px] font-medium mb-1 ${isToday ? "text-blue-600" : "text-foreground"}`}>
                  {format(day, "d")}
                </p>
                <div className="space-y-0.5">
                  {dayAuditList.slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[a.priority] || "bg-slate-400"}`} />
                      <span className="text-[10px] text-foreground truncate leading-tight">
                        {a.topic ?? a.category}
                      </span>
                    </div>
                  ))}
                  {dayAuditList.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">+{dayAuditList.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {dayAudits.map(a => (
              <div key={a.id} className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={a.status} />
                  <PriorityBadge priority={a.priority} />
                </div>
                <p className="text-[13px] font-medium text-foreground">{a.topic ?? a.category}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.submitterName} · {a.category}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{a.refNumber}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
