// Statistics — tRPC backend
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

const STATUS_PALETTE: Record<string, string> = {
  approved: "#10b981",
  pending:  "#f59e0b",
  rejected: "#ef4444",
  draft:    "#94a3b8",
};

const CHART_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6","#6366f1"];

export default function Statistics() {
  const { data: audits = [], isLoading } = trpc.audits.list.useQuery();

  const totalCount    = audits.length;
  const approvedCount = audits.filter(a => a.status === "approved").length;
  const pendingCount  = audits.filter(a => a.status === "pending").length;
  const rejectedCount = audits.filter(a => a.status === "rejected").length;

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    audits.forEach(a => { const k = a.category ?? "Unknown"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [audits]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    audits.forEach(a => { map[a.status] = (map[a.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [audits]);

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    audits.forEach(a => {
      if (!a.submittedAt) return;
      const key = format(new Date(a.submittedAt), "MMM yyyy");
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).slice(-6);
  }, [audits]);

  const byGrade = useMemo(() => {
    const map: Record<string, number> = {};
    audits.forEach(a => {
      const g = a.submitterGrade ?? "Unknown";
      map[g] = (map[g] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [audits]);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-xl font-bold text-foreground mb-1">Statistics</h2>
      <p className="text-sm text-muted-foreground mb-6">Overview of audit activity across the ENT department.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Submissions" value={totalCount} color="text-foreground" />
        <StatCard label="Approved" value={approvedCount} color="text-emerald-600" />
        <StatCard label="Pending" value={pendingCount} color="text-amber-600" />
        <StatCard label="Rejected" value={rejectedCount} color="text-red-600" />
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No audit data yet — submit some audits to see statistics.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Submissions by Category</h3>
            {byCategory.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No data yet</p> : (
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
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Submissions by Status</h3>
            {byStatus.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No data yet</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {byStatus.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_PALETTE[entry.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Submissions by Month</h3>
            {byMonth.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No data yet</p> : (
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
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Submissions by Grade</h3>
            {byGrade.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">No data yet</p> : (
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
      )}
    </div>
  );
}
