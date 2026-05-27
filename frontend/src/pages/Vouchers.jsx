import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVoucherStats } from "../api/dashboard";
import { addDriveBudget, getCertVoucherStatus, addVouchersForCert } from "../api/drives";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { ChevronDown, ChevronUp, Plus, X, AlertTriangle, DollarSign } from "lucide-react";

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

// ── Voucher entry row ─────────────────────────────────────────────────
function VoucherRow({ index, voucher, onChange, onRemove, isDuplicate, driveStartDate }) {
  const expiryInvalid = voucher.expiry_date && driveStartDate &&
    new Date(voucher.expiry_date) <= new Date(driveStartDate);

  return (
    <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${
      isDuplicate ? "border-red-300 bg-red-50" :
      expiryInvalid ? "border-amber-300 bg-amber-50" :
      "border-gray-200 bg-gray-50"
    }`}>
      <div className="col-span-5">
        <input
          className={`input text-xs ${isDuplicate ? "border-red-400" : ""}`}
          placeholder="Voucher code e.g. AZ-XXXX-YYYY"
          value={voucher.code}
          onChange={e => onChange(index, "code", e.target.value.toUpperCase())}
        />
        {isDuplicate && (
          <p className="text-red-500 text-xs mt-0.5">Duplicate code</p>
        )}
      </div>
      <div className="col-span-3">
        <input
          className="input text-xs"
          type="number"
          placeholder="₹ Amount"
          value={voucher.cost}
          onChange={e => onChange(index, "cost", e.target.value)}
        />
      </div>
      <div className="col-span-3">
        <input
          className={`input text-xs ${expiryInvalid ? "border-amber-400" : ""}`}
          type="date"
          value={voucher.expiry_date}
          onChange={e => onChange(index, "expiry_date", e.target.value)}
        />
        {expiryInvalid && (
          <p className="text-amber-600 text-xs mt-0.5">Must be after start date</p>
        )}
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Voucher manager per certification ─────────────────────────────────
function CertVoucherManager({ driveId, certId, certName, driveStartDate, budget, onVouchersAdded }) {
  const [vouchers, setVouchers] = useState([{ code: "", cost: "", expiry_date: "" }]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [extraBudget, setExtraBudget] = useState("");
  const qc = useQueryClient();

  const codes = vouchers.map(v => v.code.trim().toUpperCase()).filter(Boolean);
  const duplicateCodes = codes.filter((code, idx) => codes.indexOf(code) !== idx);

  const addRow = () => setVouchers(prev => [...prev, { code: "", cost: "", expiry_date: "" }]);
  const removeRow = (idx) => setVouchers(prev => prev.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) =>
    setVouchers(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));

  const totalCost = vouchers.reduce((sum, v) => sum + (parseFloat(v.cost) || 0), 0);
  const budgetAfter = (budget || 0) - totalCost;

  const handleSubmit = async () => {
    setLoading(true);
    setErrors([]);
    setWarnings([]);
    const valid = vouchers.filter(v => v.code.trim() && v.cost && v.expiry_date);
    if (!valid.length) {
      setErrors([{ message: "Add at least one complete voucher" }]);
      setLoading(false);
      return;
    }
    try {
      const payload = valid.map(v => ({
        code: v.code.trim().toUpperCase(),
        cost: parseFloat(v.cost),
        expiry_date: new Date(v.expiry_date).toISOString()
      }));
      const result = await addVouchersForCert(driveId, certId, payload);
      if (result.success) {
        qc.invalidateQueries(["cert-voucher-status", driveId]);
        onVouchersAdded();
        if (result.warnings?.length) setWarnings(result.warnings);
      } else {
        setErrors(result.errors || []);
        if (result.warnings?.length) setWarnings(result.warnings);
      }
    } catch (e) {
      setErrors([{ message: e.response?.data?.detail || "Failed to add vouchers" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBudget = async () => {
    if (!extraBudget || parseFloat(extraBudget) <= 0) return;
    try {
      await addDriveBudget(driveId, parseFloat(extraBudget));
      qc.invalidateQueries(["cert-voucher-status", driveId]);
      setShowAddBudget(false);
      setExtraBudget("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="font-medium text-gray-800 text-sm">{certName}</p>
        <p className="text-xs text-gray-500 mt-0.5">New vouchers will be added to existing ones</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Budget remaining:{" "}
          <span className={`font-medium ${budgetAfter < 0 ? "text-red-600" : "text-green-600"}`}>
            ₹{(budget || 0).toLocaleString()}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
        <div className="col-span-5">Voucher Code *</div>
        <div className="col-span-3">Amount (₹) *</div>
        <div className="col-span-3">Expiry Date *</div>
        <div className="col-span-1"></div>
      </div>

      <div className="space-y-2">
        {vouchers.map((v, idx) => (
          <VoucherRow
            key={idx}
            index={idx}
            voucher={v}
            onChange={updateRow}
            onRemove={removeRow}
            isDuplicate={v.code.trim() && duplicateCodes.includes(v.code.trim().toUpperCase())}
            driveStartDate={driveStartDate}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        <Plus size={12} />
        Add another voucher
      </button>

      {totalCost > 0 && (
        <div className={`rounded-lg px-3 py-2 text-xs ${
          budgetAfter < 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
        }`}>
          <div className="flex justify-between">
            <span className="text-gray-600">Total cost:</span>
            <span className="font-medium">₹{totalCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-600">Budget after:</span>
            <span className={`font-medium ${budgetAfter < 0 ? "text-red-600" : "text-green-600"}`}>
              ₹{budgetAfter.toLocaleString()}
            </span>
          </div>
          {budgetAfter < 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowAddBudget(true)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                <DollarSign size={11} />
                Add budget to continue
              </button>
            </div>
          )}
        </div>
      )}

      {showAddBudget && (
        <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
          <input
            className="input flex-1 text-sm"
            type="number"
            placeholder="Additional budget amount"
            value={extraBudget}
            onChange={e => setExtraBudget(e.target.value)}
          />
          <button onClick={handleAddBudget} className="btn-primary text-sm px-3 py-2">Add</button>
          <button onClick={() => setShowAddBudget(false)} className="text-gray-400">
            <X size={16} />
          </button>
        </div>
      )}

      {errors.map((e, i) => (
        <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          ⚠ {e.message}
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
          ⚠ {w.message}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={loading || duplicateCodes.length > 0 || budgetAfter < 0}
        className="btn-primary w-full text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            Saving...
          </>
        ) : "Add More Vouchers"}
      </button>
    </div>
  );
}

function AddVouchersModal({ drive, onClose, onSuccess }) {
  const qc = useQueryClient();

  const { data: certStatus, isLoading } = useQuery({
    queryKey: ["cert-voucher-status", drive.drive_id],
    queryFn: () => getCertVoucherStatus(drive.drive_id),
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Add Vouchers</h2>
            <p className="text-xs text-gray-500 mt-0.5">{drive.drive_name}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading certifications...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Budget remaining</p>
                <p className="font-semibold text-green-700 text-sm">
                  ₹{(certStatus?.budget_remaining || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Certifications</p>
                <p className="font-semibold text-gray-800 text-sm">
                  {certStatus?.certifications?.length || 0} linked
                </p>
              </div>
            </div>

            {certStatus?.certifications?.map(cert => (
              <CertVoucherManager
                key={cert.cert_id}
                driveId={drive.drive_id}
                certId={cert.cert_id}
                certName={cert.cert_name}
                driveStartDate={drive.start_date}
                budget={certStatus.budget_remaining}
                onVouchersAdded={() => {
                  qc.invalidateQueries(["voucher-stats"]);
                  onSuccess();
                }}
              />
            ))}

            <button onClick={onClose} className="btn-secondary w-full">
              Close
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
              {drive.drive_status === "active" &&
                drive.certifications?.some(c => c.is_exhausted) && (
                <span
                  className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full"
                  title="One or more certifications have no available vouchers"
                >
                  <AlertTriangle size={11} />
                  Vouchers exhausted
                </span>
              )}
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