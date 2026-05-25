import { useQuery } from "@tanstack/react-query";
import { getAdminDashboard, getDriveFunnel, getPassFail } from "../../api/dashboard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { TrendingUp, Users, Award, DollarSign, Shield, Activity } from "lucide-react";

function StatCard({ label, value, sub, icon: Icon, color = "text-blue-600" }) {
  return (
    <div className="card flex items-start gap-3">
      <div className={`p-2 rounded-lg bg-blue-50 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  const COLORS = ["#378ADD", "#1D9E75", "#BA7517", "#534AB7", "#D85A30"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, {user?.name} — full platform overview
          </p>
        </div>
        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-200">
          Admin
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Total drives"
          value={stats?.total_drives ?? 0}
          sub={`${stats?.active_drives ?? 0} active`}
          icon={Activity}
          color="text-blue-600"
        />
        <StatCard
          label="Total registrations"
          value={stats?.total_registrations ?? 0}
          sub={`${stats?.eligible_count ?? 0} eligible`}
          icon={Users}
          color="text-teal-600"
        />
        <StatCard
          label="Certified employees"
          value={stats?.passed_count ?? 0}
          sub={`${stats?.failed_count ?? 0} failed`}
          icon={Award}
          color="text-green-600"
        />
        <StatCard
          label="Vouchers issued"
          value={stats?.vouchers_issued ?? 0}
          sub={`${stats?.vouchers_redeemed ?? 0} redeemed`}
          icon={Shield}
          color="text-purple-600"
        />
        <StatCard
          label="Budget spent"
          value={`₹${(stats?.budget_total ?? 0).toLocaleString()}`}
          sub={`₹${stats?.roi_cost_per_certified ?? 0} per certified`}
          icon={DollarSign}
          color="text-amber-600"
        />
        <StatCard
          label="SLA compliance"
          value={`${stats?.sla_compliance_pct ?? 0}%`}
          sub="ACK emails ≤5 min"
          icon={TrendingUp}
          color="text-green-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Drive funnel
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {(funnel || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Pass / fail overview
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={passFail || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="outcome" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 13 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(passFail || []).map((e, i) => (
                  <Cell key={i} fill={e.outcome === "Pass" ? "#1D9E75" : "#E24B4A"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Voucher utilization */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Voucher pool summary
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Unassigned", value: stats?.vouchers_unassigned ?? 0, color: "bg-gray-100 text-gray-700" },
            { label: "Issued", value: stats?.vouchers_issued ?? 0, color: "bg-blue-100 text-blue-700" },
            { label: "Redeemed", value: stats?.vouchers_redeemed ?? 0, color: "bg-green-100 text-green-700" },
          ].map(item => (
            <div key={item.label} className={`rounded-lg p-3 text-center ${item.color}`}>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}