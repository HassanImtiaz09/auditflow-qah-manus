import { STATUS_COLORS, type AuditStatus } from "@/lib/auditConstants";

export default function StatusBadge({ status }: { status: AuditStatus }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${colors.bg} ${colors.text}`}
    >
      {status}
    </span>
  );
}
