import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidateDashboard } from "../../api/dashboard";
import { getMyCertificates, completeCourse, downloadCertificate, uploadCertificate } from "../../api/exam";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronUp, CheckCircle, Clock,
  XCircle, Award, Gift, AlertTriangle,
  ChevronRight, Download, Search, Copy, ExternalLink
} from "lucide-react";

// ── Countdown ─────────────────────────────────────────────────────────
function Countdown({ slotDatetime }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(slotDatetime) - new Date();
      if (diff <= 0) { setTimeLeft("now"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [slotDatetime]);

  return <span className="font-mono font-bold text-amber-700">{timeLeft}</span>;
}

// ── Step Tracker ──────────────────────────────────────────────────────
function TrackerStep({ label, status, detail }) {
  const cfg = {
    done:    { icon: CheckCircle, iconCls: "text-secondary", bg: "#E0F5F3", border: "#9FD8D3", labelCls: "text-[#0B1837] font-semibold" },
    active:  { icon: Clock,       iconCls: "text-primary",   bg: "#EBF3FF", border: "#B8D4F7", labelCls: "text-primary font-bold" },
    failed:  { icon: XCircle,     iconCls: "text-rose-500",  bg: "#FFF1F2", border: "#FECDD3", labelCls: "text-rose-600 font-semibold" },
    pending: { icon: Clock,       iconCls: "text-[#C8D6ED]", bg: "#F8FAFF", border: "#DDE5F4", labelCls: "text-[#8FA3BF] font-medium" },
  };
  const c = cfg[status] || cfg.pending;
  const Icon = c.icon;

  return (
    <div className="flex gap-3.5 items-start">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
        style={{ background: c.bg, border: `1.5px solid ${c.border}` }}
      >
        <Icon size={15} className={c.iconCls} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 pt-1">
        <p className={`text-sm leading-tight ${c.labelCls}`}>{label}</p>
        {detail && (
          <p className="text-xs text-[#8FA3BF] mt-0.5 leading-relaxed font-medium">{detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Certificate Uploader ──────────────────────────────────────────────
function CertificateUploader({ registrationId, onSuccess }) {
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!issuedDate || !expiryDate) { setError("Please fill in both dates"); return; }
    setLoading(true);
    setError("");
    try {
      await uploadCertificate(registrationId, {
        issued_date: issuedDate,
        expiry_date: expiryDate,
        certificate_number: certNumber || undefined,
      });
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to upload certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5 space-y-4 border" style={{ background: "#E0F5F3", borderColor: "#9FD8D3" }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-secondary/20 flex items-center justify-center">
          <Award size={15} className="text-secondary" />
        </div>
        <p className="text-sm font-bold text-[#0B1837] uppercase tracking-wider">Upload Certificate Details</p>
      </div>
      <p className="text-xs text-[#4A5E7D] font-medium leading-relaxed">
        Enter the details from your completed certification to finalise your accreditation records.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">Issued Date *</label>
          <input type="date" className="input text-sm" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">Expiry Date *</label>
          <input type="date" className="input text-sm" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">Certificate Number (optional)</label>
        <input className="input text-sm" placeholder="e.g. AZ900-2024-XXXX" value={certNumber} onChange={e => setCertNumber(e.target.value)} />
      </div>
      {error && (
        <p className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || !issuedDate || !expiryDate}
        className="btn-success w-full py-3 text-sm disabled:opacity-60"
      >
        {loading ? (
          <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Uploading...</>
        ) : (
          <><Award size={15} /> Submit Certificate</>
        )}
      </button>
    </div>
  );
}

// ── Registration Card ─────────────────────────────────────────────────
function RegistrationCard({ reg, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const handleCompleteCourse = async () => {
    setCompleting(true);
    setCompleteError("");
    try {
      await completeCourse(reg.registration_id);
      onRefresh();
    } catch (e) {
      setCompleteError(e.response?.data?.detail || "Failed to complete course");
    } finally {
      setCompleting(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSteps = () => {
    const e = reg.eligibility;
    const v = reg.voucher;
    const cert = reg.certificate;
    const voucherRedeemed = v?.status === "redeemed";
    return [
      { label: "Registered", status: "done", detail: new Date(reg.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
      { label: "Eligibility Check", status: !e ? "active" : e.decision === "eligible" ? "done" : e.decision === "ineligible" ? "failed" : "active", detail: e ? `${e.decision} · AI score: ${Math.round((e.ai_score || 0) * 100)}%` : "AI evaluation in progress..." },
      { label: "Approval", status: !e ? "pending" : e.decision === "eligible" ? "done" : e.decision === "pending_approval" ? "active" : e.decision === "ineligible" ? "failed" : "pending", detail: e?.decision === "pending_approval" ? "Awaiting approver review" : e?.decision === "eligible" ? "Approved" : e?.decision === "ineligible" ? "Rejected — not eligible" : null },
      { label: "Complete Course", status: reg.course_completed ? "done" : reg.status === "eligible" ? "active" : "pending", detail: reg.course_completed ? "Course completed" : null },
      { label: "Voucher", status: !v ? "pending" : v.status === "redeemed" ? "done" : v.status === "issued" ? "active" : "pending", detail: v ? v.status === "issued" ? `Ready to redeem · expires in ${v.days_to_expiry ?? "?"}d` : v.status === "redeemed" ? "Voucher redeemed" : v.status : reg.course_completed ? "Will be allocated soon" : null },
      { label: "Upload Certificate", status: cert ? "done" : voucherRedeemed ? "active" : "pending", detail: cert ? `Valid until ${new Date(cert.expiry_date).toLocaleDateString("en-IN")}` : voucherRedeemed ? "Submit your certificate details below" : null },
      { label: "Completed", status: reg.status === "completed" ? "done" : "pending", detail: reg.status === "completed" ? "Drive completed" : null },
    ];
  };

  const statusBadge = {
    registered: "badge-blue",
    eligible: "badge-teal",
    ineligible: "badge-red",
    pending_approval: "badge-yellow",
    course_completed: "badge-blue",
    voucher_allocated: "badge-yellow",
    voucher_redeemed: "badge-teal",
    completed: "badge-teal",
    result_pass: "badge-teal",
    result_fail: "badge-red",
  };

  return (
    <div className="bg-white border border-[#DDE5F4] hover:border-[#B8CCEB] rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden animate-fade-in">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#F8FAFF] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #EBF3FF, #E0F5F3)" }}
          >
            <Award size={17} className="text-primary" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0B1837] flex items-center gap-2">
              {reg.exam_track || reg.custom_cert_name || "Unknown"}
              {reg.is_custom_cert && (
                <span className="badge-yellow text-[9px] px-1.5 py-0.5">custom</span>
              )}
            </p>
            <p className="text-xs text-[#8FA3BF] font-medium mt-0.5">{reg.drive_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${statusBadge[reg.status] || "badge-gray"} uppercase text-[10px]`}>
            {reg.status?.replace(/_/g, " ")}
          </span>
          {expanded
            ? <ChevronUp size={15} className="text-[#8FA3BF]" />
            : <ChevronDown size={15} className="text-[#8FA3BF]" />
          }
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[#F0F4FA] px-5 py-5 space-y-5 bg-[#F8FAFF]">
          {/* Step tracker */}
          <div className="bg-white border border-[#DDE5F4] rounded-2xl p-5 shadow-card space-y-3">
            {getSteps().map((step, i, arr) => (
              <div key={i}>
                <TrackerStep {...step} />
                {i < arr.length - 1 && (
                  <div className="ml-[15px] w-0.5 h-3.5 bg-[#DDE5F4] my-1" />
                )}
              </div>
            ))}
          </div>

          {/* Slot timing */}
          {reg.slot_datetime && (
            <div className={`rounded-xl px-4 py-3 border text-xs font-semibold flex items-center gap-2 ${
              reg.slot_info?.is_past ? "bg-slate-50 border-[#DDE5F4] text-[#8FA3BF]"
              : reg.slot_info?.diff_days < 1 ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
              : reg.slot_info?.diff_days <= 2 ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-[#E0F5F3] border-[#9FD8D3] text-[#008A7C]"
            }`}>
              <Clock size={14} />
              <span>Exam slot: </span>
              <span>{new Date(reg.slot_datetime).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {!reg.slot_info?.is_past && (
                <span className="ml-auto bg-white/70 px-2 py-0.5 rounded-full border border-current/20 font-bold">
                  in <Countdown slotDatetime={reg.slot_datetime} />
                </span>
              )}
            </div>
          )}

          {/* Complete Course */}
          {reg.status === "eligible" && !reg.course_completed && (
            <div className="rounded-2xl p-5 space-y-3.5 border" style={{ background: "#EEF2FF", borderColor: "#C7D2FE" }}>
              <div>
                <p className="text-sm font-bold text-[#4338CA] uppercase tracking-wider">Accreditation Course Ready</p>
                <p className="text-xs text-[#6366F1] font-medium mt-0.5">
                  Complete your coursework and mark it finished to unlock voucher distribution.
                </p>
              </div>
              {completeError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 font-bold flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {completeError}
                </p>
              )}
              <button
                onClick={handleCompleteCourse}
                disabled={completing}
                className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-[0_2px_10px_rgba(99,102,241,0.28)] hover:shadow-[0_4px_18px_rgba(99,102,241,0.38)] hover:-translate-y-0.5 active:translate-y-0"
              >
                {completing ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Marking Complete...</>
                ) : (
                  <><CheckCircle size={15} /> Mark Course Complete</>
                )}
              </button>
            </div>
          )}

          {/* Voucher */}
          {reg.voucher?.status === "issued" && (
            <div className="rounded-2xl p-5 space-y-3.5 border" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Gift size={15} className="text-amber-600" />
                  </div>
                  <p className="text-sm font-bold text-[#0B1837] uppercase tracking-wider">Exam Voucher Assigned</p>
                </div>
                {reg.voucher.days_to_expiry !== null && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    reg.voucher.days_to_expiry <= 3
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  }`}>
                    Expires in {reg.voucher.days_to_expiry}d
                  </span>
                )}
              </div>
              <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between border border-amber-200">
                <span className="font-mono text-sm text-[#4A5E7D] font-bold tracking-widest">{reg.voucher.masked_code}</span>
                <span className="text-[10px] uppercase tracking-wider bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-200">masked</span>
              </div>
              <a
                href={reg.voucher.tokenized_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-400 text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-[0_2px_10px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_18px_rgba(245,158,11,0.4)] hover:-translate-y-0.5"
              >
                <ExternalLink size={15} />
                Redeem Voucher
              </a>
            </div>
          )}

          {/* Upload cert */}
          {reg.voucher?.status === "redeemed" && !reg.certificate && (
            <CertificateUploader registrationId={reg.registration_id} onSuccess={onRefresh} />
          )}

          {/* Certificate issued */}
          {reg.certificate && (
            <div className="rounded-2xl p-5 space-y-3 border" style={{ background: "#E0F5F3", borderColor: "#9FD8D3" }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <Award size={15} className="text-secondary" />
                </div>
                <p className="text-sm font-bold text-[#0B1837] uppercase tracking-wider">Accreditation Earned</p>
                <span className={`ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  reg.certificate.status === "active"
                    ? "bg-[#E0F5F3] text-[#008A7C] border-[#9FD8D3]"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {reg.certificate.status}
                </span>
              </div>
              <p className="text-xs text-[#4A5E7D] font-medium">
                Valid until: <span className="font-bold text-[#0B1837]">{new Date(reg.certificate.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
              </p>
              {reg.certificate.days_remaining > 0 && (
                <p className="text-xs text-secondary font-bold">{reg.certificate.days_remaining} days of validity remaining</p>
              )}
              <button
                onClick={() => downloadCertificate(reg.certificate.id)}
                className="btn-success w-full py-3 text-sm"
              >
                <Download size={15} />
                Download Certificate (PDF)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── My Certifications ─────────────────────────────────────────────────
function MyCertifications() {
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const { data: certs = [], isLoading } = useQuery({ queryKey: ["my-certificates"], queryFn: getMyCertificates });

  const filtered = certs.filter(cert => {
    const matchSearch = cert.cert_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = showExpired ? true : cert.status === "active";
    return matchSearch && matchStatus;
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[#DDE5F4] border-t-secondary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8FA3BF]" />
          <input className="input pl-9" placeholder="Search certifications..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`text-xs px-4 py-2.5 rounded-xl border font-semibold transition-all duration-200 ${
            showExpired
              ? "bg-[#0B1837] text-white border-[#0B1837]"
              : "bg-white text-[#4A5E7D] border-[#DDE5F4] hover:bg-[#F2F5FC]"
          }`}
        >
          {showExpired ? "Hide expired" : "Show expired"}
        </button>
      </div>

      {!filtered.length ? (
        <div className="card flex flex-col items-center py-12 border-dashed border-2">
          <div className="w-14 h-14 rounded-2xl bg-[#EBF3FF] flex items-center justify-center mb-4">
            <Award size={24} className="text-primary" strokeWidth={1.5} />
          </div>
          <p className="text-[#0B1837] font-bold">{search ? "No certificates match" : "No certificates yet"}</p>
          <p className="text-[#8FA3BF] text-sm mt-1">Complete a certification drive to earn badges.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cert => (
            <div key={cert.id} className="card space-y-4 hover:-translate-y-0.5 transition-all duration-300 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: cert.status === "active" ? "#E0F5F3" : "#FFF1F2" }}
                  >
                    <Award size={19} className={cert.status === "active" ? "text-secondary" : "text-rose-400"} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-bold text-[#0B1837] text-sm">{cert.cert_name}</p>
                    <p className="text-xs text-[#8FA3BF] font-medium mt-0.5">{cert.drive_name}</p>
                  </div>
                </div>
                <span className={cert.status === "active" ? "badge-teal" : "badge-red"}>
                  {cert.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#F2F5FC] rounded-xl p-3">
                  <p className="text-[#8FA3BF] font-semibold">Issued</p>
                  <p className="font-bold text-[#0B1837] mt-0.5">
                    {new Date(cert.issued_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div
                  className="rounded-xl p-3"
                  style={{ background: cert.status === "active" ? "#E0F5F3" : "#FFF1F2" }}
                >
                  <p className={cert.status === "active" ? "text-[#008A7C] font-semibold" : "text-rose-500 font-semibold"}>
                    {cert.status === "active" ? "Valid until" : "Expired on"}
                  </p>
                  <p className={`font-bold mt-0.5 ${cert.status === "active" ? "text-[#008A7C]" : "text-rose-700"}`}>
                    {new Date(cert.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              {cert.status === "active" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-secondary font-bold">{cert.days_remaining} days remaining</p>
                  <button
                    onClick={() => downloadCertificate(cert.id)}
                    className="btn-success text-xs px-3.5 py-2 text-sm"
                  >
                    <Download size={13} />
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("registrations");
  const [dateFilter, setDateFilter] = useState("current_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { data, isLoading, refetch } = useQuery({ queryKey: ["candidate-dashboard"], queryFn: getCandidateDashboard });

  const filterRegistrations = (regs) => {
    if (!regs) return [];
    const now = new Date();
    return regs.filter(reg => {
      const created = new Date(reg.created_at);
      if (dateFilter === "current_month") return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      if (dateFilter === "last_3_months") { const d = new Date(now); d.setMonth(now.getMonth() - 3); return created >= d; }
      if (dateFilter === "custom" && customStart && customEnd) return created >= new Date(customStart) && created <= new Date(customEnd + "T23:59:59");
      return true;
    });
  };

  const filteredRegs = filterRegistrations(data?.registrations);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
      <p className="text-xs text-[#8FA3BF] font-semibold uppercase tracking-widest">Loading your profile...</p>
    </div>
  );

  return (
    <div className="space-y-7 animate-fade-in">
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            Hi, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="page-subtitle">Track and manage your Maverick certification journey.</p>
        </div>
        <span className="badge-blue px-4 py-1.5 uppercase tracking-widest text-[10px] font-bold">
          Candidate Hub
        </span>
      </div>

      {/* ── Tabs ─────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F2F5FC] p-1 rounded-xl w-fit border border-[#DDE5F4]">
        {[
          { id: "registrations", label: "My Registrations" },
          { id: "certifications", label: "My Certifications" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white text-primary shadow-card border border-[#DDE5F4]"
                : "text-[#8FA3BF] hover:text-[#4A5E7D]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Registrations Tab ────────────────────── */}
      {activeTab === "registrations" && (
        <div className="space-y-5">
          {/* Date filter bar */}
          <div className="flex items-center gap-3 flex-wrap bg-white border border-[#DDE5F4] px-4 py-3 rounded-xl shadow-card">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF]">Period:</span>
            {[
              { id: "current_month", label: "This Month" },
              { id: "last_3_months", label: "Last 3 Months" },
              { id: "custom", label: "Custom Range" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border transition-all duration-200 ${
                  dateFilter === f.id
                    ? "bg-primary text-white border-transparent shadow-sm"
                    : "bg-[#F2F5FC] text-[#4A5E7D] border-[#DDE5F4] hover:border-[#B8CCEB]"
                }`}
              >
                {f.label}
              </button>
            ))}
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 ml-auto">
                <input type="date" className="input text-xs py-1.5 px-3 max-w-[130px]" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span className="text-[#8FA3BF] text-xs font-bold">to</span>
                <input type="date" className="input text-xs py-1.5 px-3 max-w-[130px]" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}
          </div>

          {/* Open Drives */}
          {data?.available_drives?.length > 0 && (
            <div className="card border-[#C8DFFE]" style={{ background: "#F2F7FF" }}>
              <p className="section-label mb-3">Open Drives — Apply Now</p>
              <div className="space-y-2.5">
                {data.available_drives.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-[#DDE5F4] shadow-card hover:shadow-card-hover transition-all duration-300">
                    <div>
                      <p className="text-sm font-bold text-[#0B1837]">{d.name}</p>
                      {d.end_date && <p className="text-xs text-[#8FA3BF] font-medium mt-0.5">Applications close {new Date(d.end_date).toLocaleDateString("en-IN")}</p>}
                    </div>
                    <button onClick={() => navigate("/registrations")} className="btn-primary text-xs px-3.5 py-2">
                      Apply Now <ChevronRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registration cards */}
          {!filteredRegs.length ? (
            <div className="card flex flex-col items-center py-14 border-dashed border-2">
              <div className="w-14 h-14 rounded-2xl bg-[#F2F5FC] flex items-center justify-center mb-4">
                <Clock size={24} className="text-[#8FA3BF] animate-pulse" strokeWidth={1.5} />
              </div>
              <p className="text-[#0B1837] font-bold">No active registrations</p>
              <p className="text-[#8FA3BF] text-sm mt-1">No registrations found in this time period.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRegs.map(reg => (
                <RegistrationCard
                  key={reg.registration_id}
                  reg={reg}
                  onRefresh={() => { qc.invalidateQueries(["candidate-dashboard"]); refetch(); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Certifications Tab ────────────────────── */}
      {activeTab === "certifications" && <MyCertifications />}
    </div>
  );
}
