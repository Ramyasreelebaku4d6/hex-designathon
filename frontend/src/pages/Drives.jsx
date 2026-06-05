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
  AlertTriangle, CheckCircle, Trash2, DollarSign,
  Pencil, FolderOpen, Activity, Zap, ArchiveX
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
    draft:  "badge-yellow",
    active: "badge-teal",
    closed: "badge-red",
  };
  return (
    <span className={`text-[10px] uppercase font-bold tracking-wide ${map[status] || "badge-gray"}`}>
      {status}
    </span>
  );
}

// ── Voucher entry row ─────────────────────────────────────────────────
function VoucherRow({ index, voucher, onChange, onRemove, isDuplicate, driveStartDate }) {
  const expiryInvalid =
    voucher.expiry_date && driveStartDate &&
    new Date(voucher.expiry_date) <= new Date(driveStartDate);

  return (
    <div className={`grid grid-cols-12 gap-3 items-center p-3.5 rounded-xl border transition-all duration-200 ${
      isDuplicate   ? "border-rose-200 bg-rose-50/30" :
      expiryInvalid ? "border-amber-200 bg-amber-50/20" :
                      "border-[#DDE5F4] bg-[#F8FAFF] hover:bg-white"
    }`}>
      <div className="col-span-5">
        <input
          className={`input text-xs ${isDuplicate ? "border-rose-300" : ""}`}
          placeholder="Voucher code e.g. AZ-XXXX-YYYY"
          value={voucher.code}
          onChange={e => onChange(index, "code", e.target.value.toUpperCase())}
        />
        {isDuplicate && (
          <p className="text-rose-600 font-bold text-[10px] mt-1">⚠ Duplicate code</p>
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
          className={`input text-xs ${expiryInvalid ? "border-amber-300" : ""}`}
          type="date"
          value={voucher.expiry_date}
          onChange={e => onChange(index, "expiry_date", e.target.value)}
        />
        {expiryInvalid && (
          <p className="text-amber-600 font-semibold text-[10px] mt-1">Must be after start date</p>
        )}
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[#8FA3BF] hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
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
  isEditing = false,
}) {
  const [vouchers, setVouchers] = useState([{ code: "", cost: "", expiry_date: "" }]);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [extraBudget, setExtraBudget]     = useState("");
  const qc = useQueryClient();

  const codes = vouchers.map(v => v.code.trim().toUpperCase()).filter(Boolean);
  const duplicateCodes = codes.filter((c, i) => codes.indexOf(c) !== i);

  const addRow    = () => setVouchers(p => [...p, { code: "", cost: "", expiry_date: "" }]);
  const removeRow = (i) => setVouchers(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) =>
    setVouchers(p => p.map((v, idx) => idx === i ? { ...v, [field]: val } : v));

  const totalCost  = vouchers.reduce((s, v) => s + (parseFloat(v.cost) || 0), 0);
  const budgetAfter = (budget || 0) - totalCost;

  const handleSubmit = async () => {
    setLoading(true); setErrors([]); setWarnings([]);
    const valid = vouchers.filter(v => v.code.trim() && v.cost && v.expiry_date);
    if (!valid.length) {
      setErrors([{ message: "Add at least one complete voucher" }]);
      setLoading(false); return;
    }
    try {
      const payload = valid.map(v => ({
        code: v.code.trim().toUpperCase(),
        cost: parseFloat(v.cost),
        expiry_date: new Date(v.expiry_date).toISOString(),
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
    } finally { setLoading(false); }
  };

  const handleAddBudget = async () => {
    if (!extraBudget || parseFloat(extraBudget) <= 0) return;
    try {
      await addDriveBudget(driveId, parseFloat(extraBudget));
      qc.invalidateQueries(["cert-voucher-status", driveId]);
      setShowAddBudget(false); setExtraBudget("");
    } catch (e) { console.error(e); }
  };

  return (
    <div className="bg-white border border-[#DDE5F4] rounded-2xl overflow-hidden shadow-card">
      {/* Card header — dark accent bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE5F4]"
        style={{ background: "linear-gradient(90deg,#F8FAFF,#F2F5FC)" }}>
        <div>
          <p className="font-bold text-[#0B1837] text-sm">
            {isEditing ? `Edit vouchers — ${certName}` : certName}
          </p>
          <p className="text-xs text-[#8FA3BF] font-medium mt-0.5">
            {isEditing
              ? "New vouchers will be added to the existing pool"
              : "Register voucher codes for this certification track"}
          </p>
          <p className="text-xs mt-1 font-semibold">
            Budget available:{" "}
            <span className={`font-bold ${budgetAfter < 0 ? "text-rose-600" : "text-secondary"}`}>
              ₹{(budget || 0).toLocaleString()}
            </span>
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => onRemoveCert(certId, certName)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-all duration-200"
          >
            <Trash2 size={11} />Remove
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {/* Column labels */}
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] px-1">
          <div className="col-span-5">Voucher Code *</div>
          <div className="col-span-3">Amount (₹) *</div>
          <div className="col-span-3">Expiry Date *</div>
          <div className="col-span-1" />
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {vouchers.map((v, idx) => (
            <VoucherRow
              key={idx} index={idx} voucher={v}
              onChange={updateRow} onRemove={removeRow}
              isDuplicate={v.code.trim() && duplicateCodes.includes(v.code.trim().toUpperCase())}
              driveStartDate={driveStartDate}
            />
          ))}
        </div>

        {/* Add row */}
        <button
          type="button" onClick={addRow}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-dark font-semibold transition-colors"
        >
          <Plus size={12} /> Add another voucher
        </button>

        {/* Cost summary */}
        {totalCost > 0 && (
          <div className={`rounded-xl px-4 py-3 text-xs border ${
            budgetAfter < 0
              ? "bg-rose-50 border-rose-200"
              : "bg-[#E0F5F3] border-[#9FD8D3]"
          }`}>
            <div className="flex justify-between font-medium">
              <span className={budgetAfter < 0 ? "text-rose-600" : "text-[#4A5E7D]"}>Total cost</span>
              <span className={budgetAfter < 0 ? "text-rose-700 font-bold" : "text-[#0B1837] font-bold"}>
                ₹{totalCost.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between mt-1.5 font-medium">
              <span className={budgetAfter < 0 ? "text-rose-600" : "text-[#4A5E7D]"}>Budget after</span>
              <span className={`font-bold ${budgetAfter < 0 ? "text-rose-700" : "text-secondary"}`}>
                ₹{budgetAfter.toLocaleString()}
              </span>
            </div>
            {budgetAfter < 0 && (
              <button
                onClick={() => setShowAddBudget(true)}
                className="mt-2 flex items-center gap-1.5 text-primary font-bold text-[11px] hover:text-primary-dark"
              >
                <DollarSign size={11} /> Add more budget
              </button>
            )}
          </div>
        )}

        {/* Add budget inline */}
        {showAddBudget && (
          <div className="bg-[#EBF3FF] rounded-xl p-3.5 flex items-center gap-2 border border-[#C8DFFE]">
            <input
              className="input flex-1 text-sm"
              type="number"
              placeholder="Additional budget (₹)"
              value={extraBudget}
              onChange={e => setExtraBudget(e.target.value)}
            />
            <button onClick={handleAddBudget} className="btn-primary text-xs px-4 py-2">Add</button>
            <button onClick={() => setShowAddBudget(false)} className="text-[#8FA3BF] hover:text-[#0B1837] transition-colors">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Errors / warnings */}
        {errors.map((e, i) => (
          <div key={i} className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-700 font-semibold flex items-center gap-1.5">
            <AlertTriangle size={13} /> {e.message}
          </div>
        ))}
        {warnings.map((w, i) => (
          <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-semibold flex items-center gap-1.5">
            <AlertTriangle size={13} /> {w.message}
          </div>
        ))}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || duplicateCodes.length > 0 || budgetAfter < 0}
          className="btn-primary w-full py-3 text-sm disabled:opacity-50"
        >
          {loading ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Saving...</>
          ) : isEditing ? "Add More Vouchers" : "Save Vouchers"}
        </button>
      </div>
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
    onSuccess: () => { qc.invalidateQueries(["drives"]); onActivated(); },
  });

  const handleRemoveCert    = (certId, certName) => setConfirmRemove({ certId, certName });
  const confirmRemoveCert   = async () => {
    if (!confirmRemove) return;
    try { await removeCertFromDrive(drive.id, confirmRemove.certId); refetch(); setConfirmRemove(null); }
    catch (e) { console.error(e); }
  };

  const canActivate = certStatus?.can_activate;
  const missing     = certStatus?.missing_vouchers || [];

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200/80 shadow-card">
      {/* ── Dark header ──────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{ background: "linear-gradient(90deg, #1C2E0E 0%, #2D4A15 100%)" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.20)", border: "1px solid rgba(245,158,11,0.35)" }}>
            <AlertTriangle size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{drive.name}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: "rgba(253,230,138,0.7)" }}>
              Add vouchers for all certifications before activating
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-yellow text-[9px] uppercase tracking-widest px-2.5 py-0.5">Draft</span>
          {expanded
            ? <ChevronUp size={16} className="text-amber-400" />
            : <ChevronDown size={16} className="text-amber-400" />}
        </div>
      </div>

      {/* ── Expanded body ─────────────── */}
      {expanded && certStatus && (
        <div className="bg-white border-t border-amber-200/60 p-5 space-y-4">
          {/* Budget + dates */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Budget remaining", value: `₹${(certStatus.budget_remaining || 0).toLocaleString()}`, color: "text-secondary" },
              { label: "Start date", value: formatDate(drive.start_date), color: "text-[#0B1837]" },
              { label: "End date", value: formatDate(drive.end_date), color: "text-[#0B1837]" },
            ].map(item => (
              <div key={item.label} className="bg-[#F8FAFF] rounded-xl px-4 py-3 border border-[#DDE5F4]">
                <p className="section-label mb-1">{item.label}</p>
                <p className={`font-bold text-sm ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Per-cert voucher managers */}
          {certStatus.certifications.map(cert => (
            <div key={cert.cert_id}>
              {cert.vouchers_added ? (
                <div className="rounded-2xl overflow-hidden border border-[#9FD8D3]">
                  <div className="flex items-center justify-between bg-[#E0F5F3] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <CheckCircle size={14} className="text-secondary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#008A7C]">{cert.cert_name}</p>
                        <p className="text-xs text-secondary font-medium">{cert.voucher_count} vouchers added ✓</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingCert(editingCert === cert.cert_id ? null : cert.cert_id)}
                      className="flex items-center gap-1.5 text-xs bg-white border border-[#9FD8D3] text-[#008A7C] px-3 py-1.5 rounded-xl hover:bg-[#E0F5F3] font-semibold transition-colors"
                    >
                      <Pencil size={11} />
                      {editingCert === cert.cert_id ? "Cancel" : "Edit"}
                    </button>
                  </div>
                  {editingCert === cert.cert_id && (
                    <div className="border-t border-[#9FD8D3]/60 p-4 bg-white">
                      <CertVoucherManager
                        driveId={drive.id} certId={cert.cert_id} certName={cert.cert_name}
                        driveStartDate={drive.start_date} budget={certStatus.budget_remaining}
                        onVouchersAdded={() => { refetch(); setEditingCert(null); }}
                        onRemoveCert={handleRemoveCert} isEditing
                      />
                    </div>
                  )}
                </div>
              ) : (
                <CertVoucherManager
                  driveId={drive.id} certId={cert.cert_id} certName={cert.cert_name}
                  driveStartDate={drive.start_date} budget={certStatus.budget_remaining}
                  onVouchersAdded={refetch} onRemoveCert={handleRemoveCert}
                />
              )}
            </div>
          ))}

          {/* Missing warning */}
          {missing.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-700">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Cannot activate — missing vouchers for:
              </p>
              <ul className="list-disc list-inside space-y-0.5 font-medium mt-1">
                {missing.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* Activate */}
          <button
            onClick={() => activateMutation.mutate()}
            disabled={!canActivate || activateMutation.isPending}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              canActivate
                ? "bg-secondary text-white hover:bg-secondary-dark shadow-[0_2px_10px_rgba(0,168,150,0.28)] hover:shadow-[0_4px_18px_rgba(0,168,150,0.38)] hover:-translate-y-0.5"
                : "bg-[#F2F5FC] text-[#8FA3BF] border border-[#DDE5F4] cursor-not-allowed"
            }`}
          >
            {activateMutation.isPending ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Activating...</>
            ) : canActivate ? (
              <><Zap size={15} />Activate Drive</>
            ) : (
              `Add vouchers for ${missing.length} certification(s) first`
            )}
          </button>
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-[#0B1837]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(7,23,41,0.20)] w-full max-w-sm p-6 space-y-4 border border-[#DDE5F4]">
            <h3 className="font-bold text-[#0B1837] text-base">Remove Certification?</h3>
            <p className="text-sm text-[#4A5E7D] leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-[#0B1837]">{confirmRemove.certName}</strong>?
              All unassigned vouchers will be removed and budget refunded.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmRemoveCert} className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors">
                Yes, Remove
              </button>
              <button onClick={() => setConfirmRemove(null)} className="flex-1 btn-secondary">Cancel</button>
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
  const [showForm, setShowForm]         = useState(false);
  const [certSearch, setCertSearch]     = useState("");
  const [certResults, setCertResults]   = useState([]);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [form, setForm] = useState({
    name: "", sponsor: "", budget: "",
    start_date: "", end_date: "", policy_url: "",
  });

  const { data: drives = [], isLoading } = useQuery({ queryKey: ["drives"], queryFn: getDrives });

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
    try { setCertResults(await searchCertifications(val)); }
    catch { setCertResults([]); }
  };

  const addCertToSelected = (cert) => {
    if (!selectedCerts.find(c => c.id === cert.id)) setSelectedCerts(p => [...p, cert]);
    setCertSearch(""); setCertResults([]);
  };

  const addNewCert = () => {
    if (!certSearch.trim()) return;
    const newCert = { id: "new_" + Date.now(), name: certSearch.trim(), isNew: true };
    if (!selectedCerts.find(c => c.name.toLowerCase() === newCert.name.toLowerCase()))
      setSelectedCerts(p => [...p, newCert]);
    setCertSearch(""); setCertResults([]);
  };

  const removeCert = (certId) => setSelectedCerts(p => p.filter(c => c.id !== certId));

  const resetForm = () => {
    setForm({ name: "", sponsor: "", budget: "", start_date: "", end_date: "", policy_url: "" });
    setSelectedCerts([]); setCertSearch(""); setCertResults([]); setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const drive = await createMutation.mutateAsync({
        name: form.name, sponsor: form.sponsor,
        budget: parseFloat(form.budget) || 0,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date:   form.end_date   ? new Date(form.end_date).toISOString()   : null,
        policy_url: form.policy_url,
      });
      for (const cert of selectedCerts) {
        try {
          cert.isNew
            ? await addCertificationToDrive(drive.id, { name: cert.name })
            : await addCertificationToDrive(drive.id, { cert_id: cert.id });
        } catch (err) { console.error("Cert link failed:", cert.name, err); }
      }
      if (form.start_date && form.end_date) { try { await generateSlots(drive.id); } catch {} }
      qc.invalidateQueries(["drives"]);
      resetForm();
    } catch (err) { console.error("Drive creation failed:", err); }
  };

  // Stat definitions for the dark header
  const headerStats = [
    { label: "Total Drives",  value: drives.length,               icon: Activity,  color: "#4DA8FF" },
    { label: "Active",        value: countByStatus.active  || 0,  icon: Zap,        color: "#4ECDC4" },
    { label: "Draft",         value: countByStatus.draft   || 0,  icon: AlertTriangle, color: "#FCD34D" },
    { label: "Closed",        value: countByStatus.closed  || 0,  icon: ArchiveX,   color: "#F87171" },
  ];

  // Filter tab config
  const filters = [
    { id: "active", label: "Active",     dot: "bg-[#4ECDC4]" },
    { id: "draft",  label: "Draft",      dot: "bg-amber-400" },
    { id: "closed", label: "Closed",     dot: "bg-rose-400" },
    { id: "all",    label: "All Drives", dot: null },
  ];

  return (
    <div className="space-y-0 -mt-8 -mx-8">

      {/* ══════════════════════════════════════════════
          DARK HEADER SECTION
      ══════════════════════════════════════════════ */}
      <div
        className="relative px-8 pt-8 pb-7 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #071729 0%, #0C2444 55%, #0F3060 100%)" }}
      >
        {/* Dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        {/* Ambient glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,98,204,0.18) 0%, transparent 70%)" }} />

        {/* Title row */}
        <div className="relative flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}>
                <FolderOpen size={13} className="text-white" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4DA8FF]">
                MAP Platform
              </p>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Certification Drives</h1>
            <p className="text-sm text-[#7AAAD4] mt-0.5 font-medium">
              Create and manage the full drive lifecycle — from draft to certificate issuance.
            </p>
          </div>

          {["admin", "coordinator"].includes(user?.role) && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex-shrink-0
                         shadow-[0_2px_12px_rgba(0,168,150,0.35)] hover:shadow-[0_4px_20px_rgba(0,168,150,0.45)] hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "linear-gradient(135deg,#00A896,#00C6B3)" }}
            >
              <Plus size={16} strokeWidth={2.5} />
              New Drive
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
          {headerStats.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl px-4 py-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: color + "20", border: `1px solid ${color}40` }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {label}
                </p>
              </div>
              <p className="text-2xl font-extrabold text-white tracking-tight">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          LIGHT CONTENT SECTION
      ══════════════════════════════════════════════ */}
      <div className="px-8 pt-6 pb-8 space-y-5" style={{ background: "#F2F5FC" }}>

        {/* Draft drives activation */}
        {user?.role === "admin" && draftDrives.length > 0 && (
          <div className="space-y-3">
            <p className="section-label flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-500" />
              Draft drives pending activation
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

        {/* ── Dark filter bar ───────────────────────── */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: "#0C2444", width: "fit-content" }}
        >
          {filters.map(f => {
            const count = f.id === "all" ? drives.length : countByStatus[f.id] || 0;
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-white text-[#0B1837] shadow-card"
                    : "text-[#6B8EB5] hover:text-white hover:bg-white/10"
                }`}
              >
                {f.dot && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? f.dot : "bg-current opacity-50"}`} />
                )}
                {f.label}
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  isActive ? "bg-[#F2F5FC] text-[#4A5E7D]" : "bg-white/10 text-white/60"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Drives table ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[#DDE5F4] overflow-hidden shadow-card">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
              <p className="text-xs text-[#8FA3BF] font-semibold uppercase tracking-widest">Loading drives...</p>
            </div>
          ) : filteredDrives.length === 0 ? (
            <div className="p-14 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "#F2F5FC", border: "1.5px dashed #DDE5F4" }}>
                <FolderOpen size={26} className="text-[#8FA3BF]" strokeWidth={1.5} />
              </div>
              <p className="text-[#0B1837] font-bold text-base">
                No {statusFilter === "all" ? "" : statusFilter} drives found
              </p>
              <p className="text-[#8FA3BF] text-sm font-medium">
                {statusFilter !== "all" ? (
                  <button onClick={() => setStatusFilter("all")} className="text-primary font-bold hover:underline">
                    Show all drives
                  </button>
                ) : "Create your first drive to get started."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Dark table header */}
                <thead>
                  <tr style={{ background: "#0C2444" }}>
                    {["Drive Name", "Sponsor", "Budget", "Start Date", "End Date", "Status",
                      ...(user?.role === "admin" ? ["Actions"] : [])
                    ].map(col => (
                      <th
                        key={col}
                        className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "rgba(139,174,207,0.85)" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Light table body */}
                <tbody className="divide-y divide-[#F0F4FA]">
                  {filteredDrives.map((drive, idx) => (
                    <tr
                      key={drive.id}
                      className="hover:bg-[#F8FAFF] transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: drive.status === "active"
                                ? "linear-gradient(135deg,#0062CC,#00A896)"
                                : drive.status === "draft"
                                ? "linear-gradient(135deg,#D97706,#F59E0B)"
                                : "#F0F4FA",
                            }}
                          >
                            <FolderOpen size={13} className={drive.status !== "closed" ? "text-white" : "text-[#8FA3BF]"} />
                          </div>
                          <span className="font-semibold text-sm text-[#0B1837] group-hover:text-primary transition-colors">
                            {drive.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#4A5E7D] font-medium">{drive.sponsor || "—"}</td>
                      <td className="px-5 py-4 text-sm font-bold text-[#0B1837]">
                        {drive.budget ? `₹${drive.budget.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#8FA3BF] font-semibold">{formatDate(drive.start_date)}</td>
                      <td className="px-5 py-4 text-xs text-[#8FA3BF] font-semibold">{formatDate(drive.end_date)}</td>
                      <td className="px-5 py-4"><StatusBadge status={drive.status} /></td>
                      {user?.role === "admin" && (
                        <td className="px-5 py-4">
                          {drive.status === "active" && (
                            <button
                              onClick={() => statusMutation.mutate({ id: drive.id, status: "closed" })}
                              className="text-xs text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl font-semibold transition-colors"
                            >
                              Close Drive
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CREATE DRIVE MODAL
      ══════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-[#0B1837]/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(7,23,41,0.22)] w-full max-w-lg border border-[#DDE5F4] overflow-hidden">

            {/* ── Dark modal header ───── */}
            <div
              className="px-7 py-6 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #071729 0%, #0C2444 100%)" }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(0,98,204,0.15) 0%, transparent 70%)" }} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}>
                      <Plus size={11} className="text-white" strokeWidth={3} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#4DA8FF]">New Drive</p>
                  </div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Create Certification Drive</h2>
                  <p className="text-xs text-[#7AAAD4] font-medium mt-0.5">Configure a new MAP certification drive</p>
                </div>
                <button
                  onClick={resetForm}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B8EB5] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* ── Light form body ──────── */}
            <div className="p-7 max-h-[65vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                    Drive Name *
                  </label>
                  <input
                    className="input text-sm"
                    placeholder="e.g. AZ-900 Drive Q2 2025"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                      Sponsor
                    </label>
                    <input
                      className="input text-sm"
                      placeholder="e.g. Hexaware L&D"
                      value={form.sponsor}
                      onChange={e => setForm({ ...form, sponsor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                      Budget (₹)
                    </label>
                    <input
                      className="input text-sm"
                      type="number"
                      placeholder="50000"
                      value={form.budget}
                      onChange={e => setForm({ ...form, budget: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                      Start Date
                    </label>
                    <input
                      className="input text-sm"
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                      End Date
                    </label>
                    <input
                      className="input text-sm"
                      type="date"
                      value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                    Policy URL
                  </label>
                  <input
                    className="input text-sm"
                    placeholder="https://..."
                    value={form.policy_url}
                    onChange={e => setForm({ ...form, policy_url: e.target.value })}
                  />
                </div>

                {/* Certifications */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                    Certifications
                  </label>

                  {selectedCerts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedCerts.map(cert => (
                        <div
                          key={cert.id}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                          style={{ background: "#EBF3FF", borderColor: "#C8DFFE", color: "#0062CC" }}
                        >
                          <span>{cert.name}</span>
                          {cert.isNew && <span className="text-[#8FA3BF] text-[10px] font-bold">(new)</span>}
                          <button
                            type="button"
                            onClick={() => removeCert(cert.id)}
                            className="text-[#8FA3BF] hover:text-[#0062CC] transition-colors ml-0.5"
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
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8FA3BF]" />
                        <input
                          className="input pl-9 text-sm"
                          placeholder="Search certifications..."
                          value={certSearch}
                          onChange={e => handleCertSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNewCert(); } }}
                        />
                      </div>
                      {certSearch.trim() && (
                        <button
                          type="button"
                          onClick={addNewCert}
                          className="btn-secondary text-xs px-4"
                        >
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </div>
                    {certResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-[#DDE5F4] rounded-xl shadow-card-hover z-10 mt-1 max-h-44 overflow-y-auto">
                        {certResults.map(cert => (
                          <button
                            key={cert.id}
                            type="button"
                            onClick={() => addCertToSelected(cert)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#EBF3FF] text-[#0B1837] font-semibold transition-colors first:rounded-t-xl last:rounded-b-xl"
                          >
                            {cert.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8FA3BF] font-semibold uppercase tracking-wider mt-1.5">
                    Vouchers are allocated per certification track after saving.
                  </p>
                </div>

                {createMutation.isError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    {createMutation.error?.response?.data?.detail || "Failed to create drive"}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary flex-1 py-3 text-sm font-semibold"
                  >
                    {createMutation.isPending ? (
                      <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Creating...</>
                    ) : "Create Drive"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary flex-1 py-3 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
