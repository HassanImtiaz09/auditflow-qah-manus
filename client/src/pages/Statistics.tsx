// Statistics — Charts: by category, by month, by status, by grade
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { getSubmissions } from "@/lib/store";
import { AUDIT_CATEGORIES } from "@/lib/auditConstants";
import { format } from "date-fns";

const STATUS_PALETTE: Record<string, string> = {
  approved: "#10b981",
  pending:  "#f59e0b",
  rejected: "#ef4444",
  draft:    "#94a3b8",
};

const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6","#6366f1"];

export default function Statistics() {
  const submissions = getSubmissions();

  const totalCount = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const pendingCount  = submissions.filter((s) => s.status === "pending").length;
  const rejectedCount = submissions.filter((s) => s.status === "rejected").length;

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach((s) => { map[s.type] = (map[s.type] || 0) + 1; });
    return AUDIT_CATEGORIES
      .map((c) => ({ name: c.label, count: map[c.label] || 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [submissions]);

  // By status
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach((s) => { map[s.status] = (map[s.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [submissions]);

  // By month (last 6 months)
  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach((s) => {
      const key = format(new Date(s.created_date), "MMM yyyy");
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .slice(-6);
  }, [submissions]);

  // By grade
  const byGrade = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach((s) => { map[s.grade] = (map[s.grade] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [submissions]);

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className={`bg-card rounded-xl border border-border p-4 shadow-sm`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Statistics</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Overview of audit activity across the ENT department.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Submissions" value={totalCount} color="text-foreground" />
        <StatCard label="Approved" value={approvedCount} color="text-emerald-600" />
        <StatCard label="Pending" value={pendingCount} color="text-amber-600" />
        <StatCard label="Rejected" value={rejectedCount} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* By category */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Submissions by Category</h3>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By status */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Submissions by Status</h3>
          {byStatus.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {byStatus.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_PALETTE[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v, n) => [v, n]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By month */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Submissions by Month</h3>
          {byMonth.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By grade */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Submissions by Grade</h3>
          {byGrade.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byGrade} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
