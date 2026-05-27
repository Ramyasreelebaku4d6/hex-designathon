import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVoucherStats } from "../api/dashboard";
import { addMoreVouchers } from "../api/drives";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

const STATUS_COLORS = {
  unassigned: "#94A3B8",
  issued: "#378ADD",
  redeemed: "#1D9E75",
  expired: "#E24B4A"
};

function VoucherPieChart({ data }) {
  const pieData = [
    { name: "Unassigned", value: data.unassigned, color: STATUS_COLORS.unassigned },
    { name: "Issued", value: data.issued, color: STATUS_COLORS.issued },
    { name: "Redeemed", value: data.redeemed, color: STATUS_COLORS.redeemed },
    { name: "Expired", value: data.expired, color: STATUS_COLORS.expired },
  ].filter(d => d.value > 0);

  return (
    <PieChart width={160} height={160}>
      <Pie
        data={pieData}
        cx={75}
        cy={75}
        innerRadius={45}
        outerRadius={70}
        dataKey="value"
      >
        {pieData.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip
        formatter={(value, name) => [`${value} vouchers`, name]}
      />
    </PieChart>
  );
}

function AddVouchersModal({ drive, onClose, onSuccess }) {
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!budget || parseFloat(budget) <= 0) {
      setError("Enter a valid budget amount");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await addMoreVouchers(drive.drive_id, parseFloat(budget));
      setResult(res);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to generate vouchers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Add More Vouchers</h2>
            <p className="text-xs text-gray-500 mt-0.5">{drive.drive_name}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
              All vouchers for some certifications are exhausted. Add budget to
              generate new unique voucher codes via AI.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Budget (₹)
              </label>
              <input
                className="input"
                type="number"
                placeholder="e.g. 10000"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
              {budget && parseFloat(budget) > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Will generate ~{Math.floor(parseFloat(budget) / 1000)} vouchers
                  across exhausted certifications
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Generating with AI...
                  </>
                ) : "Generate Vouchers"}
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {result.vouchers_generated}
              </p>
              <p className="text-sm text-green-600 mt-1">
                new vouchers generated
              </p>
              <p className="text-xs text-green-500 mt-1">
                New total budget: ₹{result.new_total_budget?.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              {result.distribution?.map((d, i) => (
                <div key={i} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-700">{d.cert}</span>
                  <span className="font-medium text-blue-600">
                    +{d.new_vouchers} vouchers
                  </span>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DriveVoucherCard({ drive, onAddVouchers }) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = {
    active: "badge-green",
    draft: "badge-gray",
    closed: "badge-red"
  };

  const certBarData = drive.certifications.map(c => ({
    name: c.cert_name.length > 12
      ? c.cert_name.slice(0, 12) + "..."
      : c.cert_name,
    fullName: c.cert_name,
    Unassigned: c.unassigned,
    Issued: c.issued,
    Redeemed: c.redeemed,
    Expired: c.expired,
  }));

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Drive header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{drive.drive_name}</p>
              <span className={statusBadge[drive.drive_status] || "badge-gray"}>
                {drive.drive_status}
              </span>
            </div>
            {/* Dates row */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">
                📅 {formatDate(drive.start_date)} → {formatDate(drive.end_date)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Budget: ₹{(drive.budget || 0).toLocaleString()} ·
              {drive.total_vouchers} vouchers ·
              {drive.utilization_pct}% redeemed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini pie */}
          <div className="hidden md:block">
            <VoucherPieChart data={drive.totals} />
          </div>
          {/* Add vouchers button */}
          {drive.can_add_vouchers && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddVouchers(drive);
              }}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus size={12} />
              Add Vouchers
            </button>
          )}
          {expanded
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />
          }
        </div>
      </div>

      {/* Expanded content — same as before */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          {/* Summary badges */}
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(drive.totals).map(([key, val]) => (
              <div
                key={key}
                className="text-center rounded-lg py-2 px-1"
                style={{ background: STATUS_COLORS[key] + "15" }}
              >
                <p className="text-lg font-bold"
                   style={{ color: STATUS_COLORS[key] }}>
                  {val}
                </p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{key}</p>
              </div>
            ))}
          </div>

          {/* Stacked bar chart */}
          {certBarData.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-3">
                Vouchers by certification
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={certBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value, name) => [`${value}`, name]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.fullName || label
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  <Bar dataKey="Unassigned" stackId="a" fill={STATUS_COLORS.unassigned} radius={0} />
                  <Bar dataKey="Issued" stackId="a" fill={STATUS_COLORS.issued} radius={0} />
                  <Bar dataKey="Redeemed" stackId="a" fill={STATUS_COLORS.redeemed} radius={0} />
                  <Bar dataKey="Expired" stackId="a" fill={STATUS_COLORS.expired} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per cert table */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              Certification details
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Certification</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium">Unassigned</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium">Issued</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium">Redeemed</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium">Utilization</th>
                  <th className="text-center px-2 py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drive.certifications.map(cert => (
                  <tr key={cert.cert_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {cert.cert_name}
                    </td>
                    <td className="px-2 py-2 text-center text-gray-500">
                      {cert.unassigned}
                    </td>
                    <td className="px-2 py-2 text-center"
                        style={{ color: STATUS_COLORS.issued }}>
                      {cert.issued}
                    </td>
                    <td className="px-2 py-2 text-center"
                        style={{ color: STATUS_COLORS.redeemed }}>
                      {cert.redeemed}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${cert.utilization_pct}%`,
                              background: STATUS_COLORS.redeemed
                            }}
                          />
                        </div>
                        <span className="text-gray-600 text-xs">
                          {cert.utilization_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {cert.is_exhausted ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
                          Exhausted
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                          Available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Vouchers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addingTo, setAddingTo] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active"); // default active

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["voucher-stats"],
    queryFn: getVoucherStats,
  });

  // Filter drives by status
  const filteredStats = stats.filter(drive => {
    if (statusFilter === "all") return true;
    return drive.drive_status === statusFilter;
  });

  const totalVouchers = filteredStats.reduce(
    (s, d) => s + d.total_vouchers, 0
  );
  const totalRedeemed = filteredStats.reduce(
    (s, d) => s + (d.totals?.redeemed || 0), 0
  );
  const totalUnassigned = filteredStats.reduce(
    (s, d) => s + (d.totals?.unassigned || 0), 0
  );

  // Count by status for filter badges
  const countByStatus = stats.reduce((acc, d) => {
    acc[d.drive_status] = (acc[d.drive_status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vouchers</h1>
          <p className="text-gray-500 text-sm mt-1">
            Grouped by drive and certification · AI-generated unique codes
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Show:</span>
        {[
          { id: "active", label: "Active drives", color: "bg-green-600" },
          { id: "draft", label: "Draft drives", color: "bg-gray-500" },
          { id: "closed", label: "Closed drives", color: "bg-red-500" },
          { id: "all", label: "All drives", color: "bg-blue-600" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === f.id
                ? `${f.color} text-white border-transparent`
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f.label}
            {countByStatus[f.id] !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === f.id
                  ? "bg-white bg-opacity-30 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {f.id === "all"
                  ? stats.length
                  : countByStatus[f.id] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Top stats — based on filtered data */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total vouchers",
            value: totalVouchers,
            color: "text-blue-600"
          },
          {
            label: "Unassigned",
            value: totalUnassigned,
            color: "text-gray-600"
          },
          {
            label: "Redeemed",
            value: totalRedeemed,
            color: "text-green-600"
          },
          {
            label: "Utilization",
            value: totalVouchers > 0
              ? `${Math.round(totalRedeemed / totalVouchers * 100)}%`
              : "0%",
            color: "text-purple-600"
          },
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Drive cards */}
      {isLoading ? (
        <div className="card text-center py-10 text-gray-500">
          Loading voucher data...
        </div>
      ) : !filteredStats.length ? (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm">
            No {statusFilter === "all" ? "" : statusFilter} drives found.
          </p>
          {statusFilter !== "active" && (
            <button
              onClick={() => setStatusFilter("active")}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Show active drives
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStats.map(drive => (
            <DriveVoucherCard
              key={drive.drive_id}
              drive={drive}
              onAddVouchers={setAddingTo}
            />
          ))}
        </div>
      )}

      {/* Add vouchers modal */}
      {addingTo && (
        <AddVouchersModal
          drive={addingTo}
          onClose={() => setAddingTo(null)}
          onSuccess={() => {
            qc.invalidateQueries(["voucher-stats"]);
            setAddingTo(null);
          }}
        />
      )}
    </div>
  );
}