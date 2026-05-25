import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getDriveFunnel,
  getPassFail,
} from "../api/dashboard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
} from "recharts";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#0078d4", "#106ebe", "#2b88d8", "#71afe5", "#c7e0f4"];

function StatCard({ label, value, color = "text-primary" }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: funnel } = useQuery({
    queryKey: ["drive-funnel"],
    queryFn: getDriveFunnel,
  });

  const { data: passFail } = useQuery({
    queryKey: ["pass-fail"],
    queryFn: getPassFail,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back, {user?.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Drives"
          value={stats?.total_drives ?? 0}
        />
        <StatCard
          label="Registrations"
          value={stats?.total_registrations ?? 0}
        />
        <StatCard
          label="Eligible"
          value={stats?.eligible_count ?? 0}
          color="text-green-600"
        />
        <StatCard
          label="Passed"
          value={stats?.passed_count ?? 0}
          color="text-blue-600"
        />
        <StatCard
          label="Vouchers Issued"
          value={stats?.vouchers_issued ?? 0}
          color="text-purple-600"
        />
        <StatCard
          label="Redeemed"
          value={stats?.vouchers_redeemed ?? 0}
          color="text-orange-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pass/Fail Chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            Pass / Fail Overview
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={passFail || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="outcome" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 13 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(passFail || []).map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.outcome === "Pass" ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Drive Funnel */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-700 mb-4">
            Drive Funnel
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={funnel || []}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="stage"
                type="category"
                tick={{ fontSize: 11 }}
                width={110}
              />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {(funnel || []).map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}