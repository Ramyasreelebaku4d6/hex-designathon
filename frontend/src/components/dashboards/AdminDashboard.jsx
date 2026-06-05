import { useQuery } from "@tanstack/react-query";
import { getAdminDashboard, getDriveFunnel, getPassFail } from "../../api/dashboard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { TrendingUp, Users, Award, DollarSign, Shield, Activity } from "lucide-react";

const iconBg = {
  blue:   { bg: "#EBF3FF", border: "#C8DFFE", icon: "#0062CC" },
  teal:   { bg: "#E0F5F3", border: "#9FD8D3", icon: "#008A7C" },
  green:  { bg: "#ECFDF5", border: "#A7F3D0", icon: "#059669" },
  purple: { bg: "#EEF2FF", border: "#C7D2FE", icon: "#4F46E5" },
  amber:  { bg: "#FFFBEB", border: "#FDE68A", icon: "#D97706" },
};

function StatCard({ label, value, sub, icon: Icon, color = "blue" }) {
  const c = iconBg[color] || iconBg.blue;
  return (
    <div className="card group hover:-translate-y-1 transition-all duration-300 animate-fade-in">
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
          style={{ background: c.bg, border: `1.5px solid ${c.border}` }}
        >
          <Icon size={19} style={{ color: c.icon }} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="section-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {sub && (
            <p className="text-xs text-[#4A5E7D] mt-1 font-semibold truncate">{sub}</p>
          )}
        </div>
      </div>
      {/* accent line on hover */}
      <div
        className="mt-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, ${c.icon}, transparent)` }}
      />
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #DDE5F4",
  boxShadow: "0 4px 16px rgba(7,23,41,0.08)",
  fontSize: "12px",
  fontWeight: 600,
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });
  const { data: funnel } = useQuery({
    queryKey: ["drive-funnel"],
    queryFn: getDriveFunnel,
  });
  const { data: passFail } = useQuery({
    queryKey: ["pass-fail"],
    queryFn: getPassFail,
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
      <p className="text-xs text-[#8FA3BF] font-semibold uppercase tracking-widest">Loading dashboard...</p>
    </div>
  );

  const CHART_COLORS = ["#0062CC", "#00A896", "#F59E0B", "#6366F1", "#EC4899"];

  return (
    <div className="space-y-7 animate-fade-in">
      {/* ── Page header ──────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <span className="font-bold text-[#0B1837]">{user?.name}</span> — MAP certification drive snapshot
          </p>
        </div>
        <span className="badge-blue px-4 py-1.5 uppercase tracking-widest text-[10px] font-bold">
          System Admin
        </span>
      </div>

      {/* ── KPI Strip ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <StatCard
          label="Total Drives"
          value={stats?.total_drives ?? 0}
          sub={`${stats?.active_drives ?? 0} currently active`}
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="Total Registrations"
          value={stats?.total_registrations ?? 0}
          sub={`${stats?.eligible_count ?? 0} eligible candidates`}
          icon={Users}
          color="teal"
        />
        <StatCard
          label="Certified Employees"
          value={stats?.passed_count ?? 0}
          sub={`${stats?.failed_count ?? 0} failed attempts`}
          icon={Award}
          color="green"
        />
        <StatCard
          label="Vouchers Issued"
          value={stats?.vouchers_issued ?? 0}
          sub={`${stats?.vouchers_redeemed ?? 0} redeemed`}
          icon={Shield}
          color="purple"
        />
        <StatCard
          label="Budget Spent"
          value={`₹${(stats?.budget_total ?? 0).toLocaleString()}`}
          sub={`₹${stats?.roi_cost_per_certified ?? 0} per certified`}
          icon={DollarSign}
          color="amber"
        />
        <StatCard
          label="SLA Compliance"
          value={`${stats?.sla_compliance_pct ?? 0}%`}
          sub="Email alerts ≤ 5 mins"
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* ── Charts ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <p className="section-label mb-5">Drive Funnel</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
              <XAxis type="number" tick={{ fill: "#8FA3BF", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fill: "#4A5E7D", fontSize: 10, fontWeight: 700 }} width={105} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#F2F5FC" }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {(funnel || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-label mb-5">Pass / Fail Overview</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={passFail || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
              <XAxis dataKey="outcome" tick={{ fill: "#4A5E7D", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8FA3BF", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#F2F5FC" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(passFail || []).map((e, i) => (
                  <Cell key={i} fill={e.outcome === "Pass" ? "#00A896" : "#F87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Voucher Pool ─────────────────────────── */}
      <div className="card">
        <p className="section-label mb-5">Voucher Pool Summary</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Unassigned", value: stats?.vouchers_unassigned ?? 0, bg: "#F2F5FC", border: "#DDE5F4", text: "#4A5E7D", bar: "#8FA3BF" },
            { label: "Issued", value: stats?.vouchers_issued ?? 0, bg: "#EBF3FF", border: "#C8DFFE", text: "#0062CC", bar: "#0062CC" },
            { label: "Redeemed", value: stats?.vouchers_redeemed ?? 0, bg: "#E0F5F3", border: "#9FD8D3", text: "#008A7C", bar: "#00A896" },
          ].map(item => {
            const total = (stats?.vouchers_unassigned ?? 0) + (stats?.vouchers_issued ?? 0) + (stats?.vouchers_redeemed ?? 0);
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div
                key={item.label}
                className="rounded-xl p-5 border text-center transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
                style={{ background: item.bg, borderColor: item.border }}
              >
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: item.text }}>
                  {item.value}
                </p>
                <p className="text-[10px] mt-1.5 font-bold uppercase tracking-widest" style={{ color: item.text, opacity: 0.7 }}>
                  {item.label}
                </p>
                <div className="mt-3 h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: item.bar }} />
                </div>
                <p className="text-[10px] mt-1 font-semibold" style={{ color: item.text, opacity: 0.6 }}>{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
