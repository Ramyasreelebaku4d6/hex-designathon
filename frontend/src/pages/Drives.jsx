import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDrives, createDrive, updateDriveStatus,
  getCertVoucherStatus, addVouchersForCert,
  removeCertFromDrive, addDriveBudget
} from "../api/drives";
import {
  searchCertifications,
  addCertificationToDrive,
} from "../api/certifications";
import { generateSlots } from "../api/slots";
import {
  Plus, X, Search, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Trash2, DollarSign, Pencil
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
};

function StatusBadge({ status }) {
  const map = {
    draft: "badge-gray",
    active: "badge-green",
    closed: "badge-red"
  };
  return <span className={map[status] || "badge-gray"}>{status}</span>;
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
          <p className="text-red-500 text-xs mt-0.5">⚠ Duplicate code</p>
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
function CertVoucherManager({
  driveId, certId, certName, driveStartDate,
  budget, onVouchersAdded, onRemoveCert,
  isEditing = false
}) {
  const [vouchers, setVouchers] = useState([
    { code: "", cost: "", expiry_date: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [extraBudget, setExtraBudget] = useState("");
  const qc = useQueryClient();

  // Find duplicates within current input
  const codes = vouchers.map(v => v.code.trim().toUpperCase()).filter(Boolean);
  const duplicateCodes = codes.filter(
    (code, idx) => codes.indexOf(code) !== idx
  );

  const addRow = () => {
    setVouchers(prev => [...prev, { code: "", cost: "", expiry_date: "" }]);
  };

  const removeRow = (idx) => {
    setVouchers(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    setVouchers(prev => prev.map((v, i) =>
      i === idx ? { ...v, [field]: value } : v
    ));
  };

  const totalCost = vouchers.reduce(
    (sum, v) => sum + (parseFloat(v.cost) || 0), 0
  );
  const budgetAfter = (budget || 0) - totalCost;

  const handleSubmit = async () => {
    setLoading(true);
    setErrors([]);
    setWarnings([]);

    const valid = vouchers.filter(
      v => v.code.trim() && v.cost && v.expiry_date
    );

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
        onVouchersAdded();
        qc.invalidateQueries(["cert-voucher-status", driveId]);
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
      {/* Cert header */}
<div className="flex items-center justify-between">
  <div>
    <p className="font-medium text-gray-800 text-sm">
      {isEditing ? `Edit vouchers — ${certName}` : certName}
    </p>
    <p className="text-xs text-gray-500 mt-0.5">
      {isEditing
        ? "New vouchers will be added to existing ones"
        : "Add voucher codes for this certification"
      }
    </p>
    <p className="text-xs text-gray-500 mt-0.5">
      Budget remaining:{" "}
      <span className={`font-medium ${
        budgetAfter < 0 ? "text-red-600" : "text-green-600"
      }`}>
        ₹{(budget || 0).toLocaleString()}
      </span>
    </p>
  </div>
  {!isEditing && (
    <button
      onClick={() => onRemoveCert(certId, certName)}
      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg"
    >
      <Trash2 size={11} />
      Remove cert
    </button>
  )}
</div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-2">
        <div className="col-span-5">Voucher Code *</div>
        <div className="col-span-3">Amount (₹) *</div>
        <div className="col-span-3">Expiry Date *</div>
        <div className="col-span-1"></div>
      </div>

      {/* Voucher rows */}
      <div className="space-y-2">
        {vouchers.map((v, idx) => (
          <VoucherRow
            key={idx}
            index={idx}
            voucher={v}
            onChange={updateRow}
            onRemove={removeRow}
            isDuplicate={
              v.code.trim() &&
              duplicateCodes.includes(v.code.trim().toUpperCase())
            }
            driveStartDate={driveStartDate}
          />
        ))}
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
      >
        <Plus size={12} />
        Add another voucher
      </button>

      {/* Cost summary */}
      {totalCost > 0 && (
        <div className={`rounded-lg px-3 py-2 text-xs ${
          budgetAfter < 0
            ? "bg-red-50 border border-red-200"
            : "bg-green-50 border border-green-200"
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

      {/* Add budget inline */}
      {showAddBudget && (
        <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2">
          <input
            className="input flex-1 text-sm"
            type="number"
            placeholder="Additional budget amount"
            value={extraBudget}
            onChange={e => setExtraBudget(e.target.value)}
          />
          <button
            onClick={handleAddBudget}
            className="btn-primary text-sm px-3 py-2"
          >
            Add
          </button>
          <button
            onClick={() => setShowAddBudget(false)}
            className="text-gray-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Errors */}
      {errors.map((e, i) => (
        <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
          ⚠ {e.message}
        </div>
      ))}

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
          ⚠ {w.message}
        </div>
      ))}

      {/* Submit */}
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
  ) : isEditing ? "Add More Vouchers" : "Save Vouchers"}
</button>
    </div>
  );
}

// ── Drive activation panel ────────────────────────────────────────────
function DriveActivationPanel({ drive, onActivated }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [editingCert, setEditingCert] = useState(null);
  const qc = useQueryClient();

  const { data: certStatus, refetch } = useQuery({
    queryKey: ["cert-voucher-status", drive.id],
    queryFn: () => getCertVoucherStatus(drive.id),
    enabled: expanded,
  });

  const activateMutation = useMutation({
    mutationFn: () => updateDriveStatus(drive.id, "active"),
    onSuccess: () => {
      qc.invalidateQueries(["drives"]);
      onActivated();
    },
  });

  const handleRemoveCert = async (certId, certName) => {
    setConfirmRemove({ certId, certName });
  };

  const confirmRemoveCert = async () => {
    if (!confirmRemove) return;
    try {
      await removeCertFromDrive(drive.id, confirmRemove.certId);
      refetch();
      setConfirmRemove(null);
    } catch (e) {
      console.error(e);
    }
  };

  const canActivate = certStatus?.can_activate;
  const missing = certStatus?.missing_vouchers || [];

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {drive.name} — Ready to activate?
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Add vouchers for all certifications before activating
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-amber-600" />
          : <ChevronDown size={16} className="text-amber-600" />
        }
      </div>

      {expanded && certStatus && (
        <div className="border-t border-amber-200 p-4 space-y-4 bg-white">
          {/* Budget + dates info */}
<div className="grid grid-cols-3 gap-3">
  <div className="bg-gray-50 rounded-lg px-3 py-2">
    <p className="text-xs text-gray-500">Budget remaining</p>
    <p className="font-semibold text-green-700 text-sm">
      ₹{(certStatus.budget_remaining || 0).toLocaleString()}
    </p>
  </div>
  <div className="bg-gray-50 rounded-lg px-3 py-2">
    <p className="text-xs text-gray-500">Start date</p>
    <p className="font-semibold text-gray-800 text-sm">
      {formatDate(drive.start_date)}
    </p>
  </div>
  <div className="bg-gray-50 rounded-lg px-3 py-2">
    <p className="text-xs text-gray-500">End date</p>
    <p className="font-semibold text-gray-800 text-sm">
      {formatDate(drive.end_date)}
    </p>
  </div>
</div>

          {/* Per cert voucher managers */}
          {certStatus.certifications.map(cert => (
            <div key={cert.cert_id}>
              {cert.vouchers_added ? (
  <div className="border border-green-200 rounded-xl overflow-hidden">
    <div className="flex items-center justify-between bg-green-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">
            {cert.cert_name}
          </p>
          <p className="text-xs text-green-600">
            {cert.voucher_count} vouchers added ✓
          </p>
        </div>
      </div>
      <button
        onClick={() => setEditingCert(
          editingCert === cert.cert_id ? null : cert.cert_id
        )}
        className="text-xs bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 flex items-center gap-1"
      >
        <Pencil size={11} />
        {editingCert === cert.cert_id ? "Cancel edit" : "Edit vouchers"}
      </button>
    </div>

    {/* Edit mode */}
    {editingCert === cert.cert_id && (
      <div className="border-t border-green-100 p-4 bg-white">
        <CertVoucherManager
          driveId={drive.id}
          certId={cert.cert_id}
          certName={cert.cert_name}
          driveStartDate={drive.start_date}
          budget={certStatus.budget_remaining}
          onVouchersAdded={() => {
            refetch();
            setEditingCert(null);
          }}
          onRemoveCert={handleRemoveCert}
          isEditing={true}
        />
      </div>
    )}
  </div>
              ) : (
                <CertVoucherManager
                  driveId={drive.id}
                  certId={cert.cert_id}
                  certName={cert.cert_name}
                  driveStartDate={drive.start_date}
                  budget={certStatus.budget_remaining}
                  onVouchersAdded={refetch}
                  onRemoveCert={handleRemoveCert}
                />
              )}
            </div>
          ))}

          {/* Missing warning */}
          {missing.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <p className="font-medium mb-1">
                Cannot activate — vouchers missing for:
              </p>
              <ul className="list-disc list-inside">
                {missing.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* Activate button */}
          <button
            onClick={() => activateMutation.mutate()}
            disabled={!canActivate || activateMutation.isPending}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-colors ${
              canActivate
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {activateMutation.isPending
              ? "Activating..."
              : canActivate
              ? "✓ Activate Drive"
              : `Add vouchers for ${missing.length} certification(s) first`
            }
          </button>
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">Remove Certification?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove
              <strong> {confirmRemove.certName}</strong> from this drive?
              All unassigned vouchers for this certification will also be removed
              and budget refunded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmRemoveCert}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700"
              >
                Yes, Remove
              </button>
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Drives page ──────────────────────────────────────────────────
export default function Drives() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [certSearch, setCertSearch] = useState("");
  const [certResults, setCertResults] = useState([]);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [form, setForm] = useState({
    name: "", sponsor: "", budget: "",
    start_date: "", end_date: "", policy_url: "",
  });

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const filteredDrives = drives
    .filter(d => statusFilter === "all" || d.status === statusFilter)
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    });

  const draftDrives = drives.filter(d => d.status === "draft");

  const countByStatus = drives.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  const createMutation = useMutation({ mutationFn: createDrive });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateDriveStatus(id, status),
    onSuccess: () => qc.invalidateQueries(["drives"]),
  });

  const handleCertSearch = async (val) => {
    setCertSearch(val);
    if (val.length < 1) { setCertResults([]); return; }
    try {
      const results = await searchCertifications(val);
      setCertResults(results);
    } catch { setCertResults([]); }
  };

  const addCertToSelected = (cert) => {
    if (!selectedCerts.find(c => c.id === cert.id)) {
      setSelectedCerts(prev => [...prev, cert]);
    }
    setCertSearch(""); setCertResults([]);
  };

  const addNewCert = () => {
    if (!certSearch.trim()) return;
    const newCert = {
      id: "new_" + Date.now(),
      name: certSearch.trim(),
      isNew: true
    };
    if (!selectedCerts.find(c =>
      c.name.toLowerCase() === newCert.name.toLowerCase()
    )) {
      setSelectedCerts(prev => [...prev, newCert]);
    }
    setCertSearch(""); setCertResults([]);
  };

  const removeCert = (certId) => {
    setSelectedCerts(prev => prev.filter(c => c.id !== certId));
  };

  const resetForm = () => {
    setForm({
      name: "", sponsor: "", budget: "",
      start_date: "", end_date: "", policy_url: "",
    });
    setSelectedCerts([]);
    setCertSearch(""); setCertResults([]);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const drive = await createMutation.mutateAsync({
        name: form.name,
        sponsor: form.sponsor,
        budget: parseFloat(form.budget) || 0,
        start_date: form.start_date
          ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date
          ? new Date(form.end_date).toISOString() : null,
        policy_url: form.policy_url,
      });

      for (const cert of selectedCerts) {
        try {
          if (cert.isNew) {
            await addCertificationToDrive(drive.id, { name: cert.name });
          } else {
            await addCertificationToDrive(drive.id, { cert_id: cert.id });
          }
        } catch (err) {
          console.error("Cert link failed:", cert.name, err);
        }
      }

      if (form.start_date && form.end_date) {
        try { await generateSlots(drive.id); } catch {}
      }

      qc.invalidateQueries(["drives"]);
      resetForm();
    } catch (err) {
      console.error("Drive creation failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Drives</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage certification drives
          </p>
        </div>
        {["admin", "coordinator"].includes(user?.role) && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            New Drive
          </button>
        )}
      </div>

      {/* Draft drives needing vouchers — shown to admin */}
      {user?.role === "admin" && draftDrives.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-700">
            ⚠ Draft drives — add vouchers to activate
          </p>
          {draftDrives.map(drive => (
            <DriveActivationPanel
              key={drive.id}
              drive={drive}
              onActivated={() => qc.invalidateQueries(["drives"])}
            />
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Show:</span>
        {[
          { id: "active", label: "Active", color: "bg-green-600" },
          { id: "draft", label: "Draft", color: "bg-gray-500" },
          { id: "closed", label: "Closed", color: "bg-red-500" },
          { id: "all", label: "All", color: "bg-blue-600" },
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
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              statusFilter === f.id
                ? "bg-white bg-opacity-30 text-white"
                : "bg-gray-100 text-gray-600"
            }`}>
              {f.id === "all" ? drives.length : countByStatus[f.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Create Drive Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Drive</h2>
              <button onClick={resetForm}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drive Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. AZ-900 Drive Q2 2025"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsor
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Hexaware L&D"
                    value={form.sponsor}
                    onChange={e =>
                      setForm({ ...form, sponsor: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget (₹)
                  </label>
                  <input
                    className="input"
                    type="number"
                    placeholder="50000"
                    value={form.budget}
                    onChange={e =>
                      setForm({ ...form, budget: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.start_date}
                    onChange={e =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.end_date}
                    onChange={e =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy URL
                </label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.policy_url}
                  onChange={e =>
                    setForm({ ...form, policy_url: e.target.value })
                  }
                />
              </div>

              {/* Certifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certifications
                </label>
                {selectedCerts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedCerts.map(cert => (
                      <div
                        key={cert.id}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200"
                      >
                        {cert.name}
                        {cert.isNew && (
                          <span className="text-blue-400">(new)</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCert(cert.id)}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                      <input
                        className="input pl-8"
                        placeholder="Search certifications..."
                        value={certSearch}
                        onChange={e => handleCertSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addNewCert();
                          }
                        }}
                      />
                    </div>
                    {certSearch.trim() && (
                      <button
                        type="button"
                        onClick={addNewCert}
                        className="btn-secondary text-xs px-3"
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    )}
                  </div>
                  {certResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                      {certResults.map(cert => (
                        <button
                          key={cert.id}
                          type="button"
                          onClick={() => addCertToSelected(cert)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                        >
                          {cert.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  You will add voucher codes per certification before activating
                </p>
              </div>

              {createMutation.isError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {createMutation.error?.response?.data?.detail ||
                    "Failed to create drive"}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? "Creating..." : "Create Drive"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drives table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Loading drives...
          </div>
        ) : filteredDrives.length === 0 ? (
          <div className="p-8 text-center text-gray-500 space-y-2">
            <p>No {statusFilter === "all" ? "" : statusFilter} drives found.</p>
            {statusFilter !== "all" && (
              <button
                onClick={() => setStatusFilter("all")}
                className="text-xs text-blue-600 hover:underline"
              >
                Show all drives
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Drive Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sponsor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Start Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">End Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                {user?.role === "admin" && (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrives.map(drive => (
                <tr key={drive.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {drive.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.sponsor || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.budget
                      ? `₹${drive.budget.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDate(drive.start_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDate(drive.end_date)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={drive.status} />
                  </td>
                  {user?.role === "admin" && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {drive.status === "active" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: drive.id,
                                status: "closed"
                              })
                            }
                            className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}