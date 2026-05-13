import { PRIORITY_COLORS } from "@/lib/auditConstants";

export default function PriorityBadge({ priority }: { priority: string }) {
  const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Routine;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      {priority}
    </span>
  );
}
