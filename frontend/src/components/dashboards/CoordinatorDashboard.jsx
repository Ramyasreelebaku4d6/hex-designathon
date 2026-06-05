import { useQuery } from "@tanstack/react-query";
import { getCoordinatorDashboard, getDriveFunnel } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { ClipboardList, AlertTriangle, UserCheck, Clock, ArrowRight } from "lucide-react";

const chartTooltipStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #DDE5F4",
  boxShadow: "0 4px 16px rgba(7,23,41,0.08)",
  fontSize: "12px",
  fontWeight: 600,
};

function ActionCard({ label, value, sub, icon: Icon, color, onClick }) {
  const hasAction = value > 0;
  return (
    <div
      className="card group cursor-pointer hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
      style={hasAction ? { borderTop: `3px solid ${color}` } : {}}
      onClick={onClick}
    >
      {/* glow overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at 20% 50%, ${color}08 0%, transparent 70%)` }}
      />

      <div className="flex items-start gap-3.5 relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
          style={{ background: `${color}14`, border: `1.5px solid ${color}28` }}
        >
          <Icon size={19} style={{ color }} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="section-label">{label}</p>
          <p className="text-2xl font-bold tracking-tight mt-1" style={{ color }}>
            {value}
          </p>
          {sub && (
            <p className="text-xs text-[#4A5E7D] mt-1 font-medium truncate">{sub}</p>
          )}
        </div>
        <ArrowRight
          size={14}
          className="flex-shrink-0 text-[#C8D6ED] group-hover:text-[color:var(--c)] group-hover:translate-x-0.5 transition-all duration-200 mt-1"
          style={{ "--c": color }}
        />
      </div>
    </div>
  );
}

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["coordinator-dashboard"],
    queryFn: getCoordinatorDashboard,
  });
  const { data: funnel } = useQuery({
    queryKey: ["drive-funnel"],
    queryFn: getDriveFunnel,
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
      <p className="text-xs text-[#8FA3BF] font-semibold uppercase tracking-widest">Loading dashboard...</p>
    </div>
  );

  const weeklyData = [
    { week: "Last Week", count: stats?.registrations_last_week ?? 0 },
    { week: "This Week", count: stats?.registrations_this_week ?? 0 },
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Coordinator Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <span className="font-bold text-[#0B1837]">{user?.name}</span> — operational drive tracking
          </p>
        </div>
        <span className="badge-green px-4 py-1.5 uppercase tracking-widest text-[10px] font-bold">
          Coordinator
        </span>
      </div>

      {/* ── Action Items ─────────────────────────── */}
      <div>
        <p className="section-label mb-3">Action Items — Needs Attention</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionCard
            label="Pending Evaluations"
            value={stats?.pending_evaluations ?? 0}
            sub="Need AI assessment"
            icon={ClipboardList}
            color="#0062CC"
            onClick={() => navigate("/eligibility")}
          />
          <ActionCard
            label="Pending Approvals"
            value={stats?.pending_approvals ?? 0}
            sub="Awaiting approver"
            icon={UserCheck}
            color="#D97706"
            onClick={() => navigate("/eligibility")}
          />
          <ActionCard
            label="Expiring Soon"
            value={stats?.vouchers_expiring_7_days ?? 0}
            sub="Vouchers within 7 days"
            icon={AlertTriangle}
            color="#EF4444"
            onClick={() => navigate("/vouchers")}
          />
          <ActionCard
            label="Unallocated Vouchers"
            value={stats?.unallocated_vouchers ?? 0}
            sub="No voucher assigned"
            icon={Clock}
            color="#6366F1"
            onClick={() => navigate("/vouchers")}
          />
        </div>
      </div>

      {/* ── Charts ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <p className="section-label mb-5">Registrations — This Week vs Last</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
              <XAxis dataKey="week" tick={{ fill: "#4A5E7D", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8FA3BF", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#F2F5FC" }} />
              <Bar dataKey="count" fill="#0062CC" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-label mb-5">Active Drive Funnel</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnel || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
              <XAxis type="number" tick={{ fill: "#8FA3BF", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fill: "#4A5E7D", fontSize: 10, fontWeight: 700 }} width={105} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#F2F5FC" }} />
              <Bar dataKey="count" fill="#00A896" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Registrations ─────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DDE5F4] flex items-center justify-between bg-[#F8FAFF]">
          <p className="section-label">Recent Registrations</p>
          <button
            onClick={() => navigate("/registrations")}
            className="text-xs text-primary font-bold hover:text-primary-dark flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>

        {!stats?.recent_registrations?.length ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#8FA3BF] font-semibold">No recent registrations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#DDE5F4] bg-[#F8FAFF]">
                  <th className="table-th">Candidate</th>
                  <th className="table-th">Drive</th>
                  <th className="table-th">Track</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FA]">
                {stats.recent_registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8FAFF] transition-colors">
                    <td className="table-td font-semibold">{r.candidate_name}</td>
                    <td className="px-5 py-3.5 text-sm text-[#4A5E7D] font-medium">{r.drive_name}</td>
                    <td className="px-5 py-3.5 text-sm text-[#0B1837] font-semibold">{r.exam_track || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                        r.status === "eligible" || r.status === "completed"
                          ? "badge-teal"
                          : r.status === "submitted" || r.status === "registered"
                          ? "badge-blue"
                          : "badge-gray"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
