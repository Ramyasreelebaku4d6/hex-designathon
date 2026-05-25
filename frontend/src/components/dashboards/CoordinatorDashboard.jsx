import { useQuery } from "@tanstack/react-query";
import { getCoordinatorDashboard, getDriveFunnel } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { ClipboardList, AlertTriangle, UserCheck, Clock } from "lucide-react";

function ActionCard({ label, value, sub, icon: Icon, color, onClick }) {
  return (
    <div
      className={`card flex items-start gap-3 cursor-pointer hover:border-blue-300 transition-colors ${value > 0 ? "border-l-4" : ""}`}
      style={value > 0 ? { borderLeftColor: color } : {}}
      onClick={onClick}
    >
      <div className="p-2 rounded-lg" style={{ background: color + "20" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  const weeklyData = [
    { week: "Last week", count: stats?.registrations_last_week ?? 0 },
    { week: "This week", count: stats?.registrations_this_week ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Coordinator Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, {user?.name} — operational view
          </p>
        </div>
        <span className="bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full border border-green-200">
          Coordinator
        </span>
      </div>

      {/* Action items — things needing attention */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">
          Action items
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionCard
            label="Pending evaluations"
            value={stats?.pending_evaluations ?? 0}
            sub="Need AI evaluation"
            icon={ClipboardList}
            color="#378ADD"
            onClick={() => navigate("/eligibility")}
          />
          <ActionCard
            label="Pending approvals"
            value={stats?.pending_approvals ?? 0}
            sub="Awaiting approver"
            icon={UserCheck}
            color="#BA7517"
            onClick={() => navigate("/eligibility")}
          />
          <ActionCard
            label="Expiring soon"
            value={stats?.vouchers_expiring_7_days ?? 0}
            sub="Vouchers in 7 days"
            icon={AlertTriangle}
            color="#E24B4A"
            onClick={() => navigate("/vouchers")}
          />
          <ActionCard
            label="Unallocated vouchers"
            value={stats?.unallocated_vouchers ?? 0}
            sub="Passed but no voucher"
            icon={Clock}
            color="#534AB7"
            onClick={() => navigate("/vouchers")}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Registrations — this week vs last week
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#378ADD" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Active drive funnel
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnel || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#1D9E75" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent registrations feed */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Recent registrations
          </h2>
          <button
            onClick={() => navigate("/registrations")}
            className="text-xs text-blue-600 hover:underline"
          >
            View all
          </button>
        </div>
        {!stats?.recent_registrations?.length ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No recent registrations
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Candidate</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Drive</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Track</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recent_registrations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.candidate_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.drive_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.exam_track || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "eligible" ? "bg-green-100 text-green-700" :
                      r.status === "submitted" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}