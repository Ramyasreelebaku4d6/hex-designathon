import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidateDashboard } from "../../api/dashboard";
import { getMyCertificates, verifyVoucher, startExam, submitExam,completeCourse } from "../../api/exam";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronUp, CheckCircle, Clock,
  XCircle, Award, Gift, AlertTriangle,
  ChevronRight, Download, Search, Copy, ExternalLink
} from "lucide-react";

// ── Countdown timer component ─────────────────────────────────────────
function Countdown({ slotDatetime }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const slot = new Date(slotDatetime);
      const diff = slot - now;
      if (diff <= 0) {
        setTimeLeft("now");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [slotDatetime]);

  return (
    <span className="font-mono text-amber-700 font-medium">{timeLeft}</span>
  );
}

// ── Step tracker ──────────────────────────────────────────────────────
function TrackerStep({ label, status, detail }) {
  const cfg = {
    done: { icon: CheckCircle, cls: "text-green-600", bg: "bg-green-100" },
    active: { icon: Clock, cls: "text-blue-600", bg: "bg-blue-100" },
    failed: { icon: XCircle, cls: "text-red-500", bg: "bg-red-100" },
    pending: { icon: Clock, cls: "text-gray-400", bg: "bg-gray-100" },
  };
  const c = cfg[status] || cfg.pending;
  const Icon = c.icon;
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon size={14} className={c.cls} />
      </div>
      <div>
        <p className={`text-sm font-medium ${status === "pending" ? "text-gray-400" : "text-gray-800"}`}>
          {label}
        </p>
        {detail && (
          <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

// ── Voucher entry + exam start ────────────────────────────────────────
function ExamStarter({ reg, onSuccess }) {
  const [step, setStep] = useState("enter"); // enter | verified | started
  const [code, setCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const slotReached = reg.slot_datetime
    ? new Date(reg.slot_datetime) <= new Date()
    : true;

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await verifyVoucher(reg.registration_id, code);
      setVerifyResult(res);
      setStep("verified");
    } catch (e) {
      setError(e.response?.data?.detail || "Invalid voucher code");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await startExam(reg.registration_id, code);
      setSessionId(res.session_id);
      setStep("started");
      window.open("about:blank", "_blank", "width=1024,height=768");
    } catch (e) {
      setError(e.response?.data?.detail || "Cannot start exam yet");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await submitExam(sessionId);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.detail || "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-blue-800">Proceed to Exam</p>

      {step === "enter" && (
        <>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Enter your redeemed voucher code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              onClick={handleVerify}
              disabled={!code || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}

      {step === "verified" && verifyResult && (
        <>
          {verifyResult.can_start ? (
            <div className="space-y-2">
              <p className="text-sm text-green-700 font-medium">
                Voucher verified. Ready to start!
              </p>
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700"
              >
                {loading ? "Starting..." : "Start Exam"}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-amber-800">
                Exam not started yet
              </p>
              <p className="text-sm text-amber-700">
                Starts in: <Countdown slotDatetime={reg.slot_datetime} />
              </p>
              <p className="text-xs text-amber-600">
                Slot: {new Date(reg.slot_datetime).toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </>
      )}

      {step === "started" && (
        <div className="space-y-2">
          <p className="text-sm text-green-700 font-medium">
            Exam is in progress in the other window.
          </p>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700"
          >
            {loading ? "Submitting..." : "Submit Exam"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Registration card with expand/collapse ────────────────────────────
function RegistrationCard({ reg, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const qc = useQueryClient();

  const handleCompleteCourse = async () => {
    setCompleting(true);
    setCompleteError("");
    try {
      await completeCourse(reg.registration_id);
      onRefresh(); // refresh dashboard to show updated state
    } catch (e) {
      setCompleteError(
        e.response?.data?.detail || "Failed to complete course"
      );
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
    const ex = reg.exam_session;
    const cert = reg.certificate;

    return [
      {
        label: "Registered",
        status: "done",
        detail: new Date(reg.created_at).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric"
        }),
      },
      {
        label: "Eligibility check",
        status: !e ? "pending"
          : e.decision === "eligible" ? "done"
          : e.decision === "ineligible" ? "failed"
          : "active",
        detail: e
          ? `${e.decision} · AI score: ${Math.round((e.ai_score || 0) * 100)}%`
          : "Awaiting evaluation",
      },
      {
        label: "Approval",
        status: !e ? "pending"
          : e.decision === "eligible" ? "done"
          : e.decision === "pending_approval" ? "active"
          : e.decision === "ineligible" ? "failed"
          : "pending",
        detail: e?.decision === "pending_approval"
          ? "Awaiting approver review"
          : e?.decision === "eligible"
          ? "Approved"
          : e?.decision === "ineligible"
          ? "Rejected"
          : null,
      },
      {
        label: "Course completion",
        status: reg.course_completed ? "done"
          : e?.decision === "eligible" ? "active"
          : "pending",
        detail: reg.course_completed ? "Course completed" : null,
      },
      {
        label: "Voucher",
        status: !v ? "pending"
          : v.status === "redeemed" || v.status === "expired" ? "done"
          : v.status === "issued" ? "active"
          : "pending",
        detail: v
          ? `${v.status} · ${v.masked_code || ""}`
          : reg.course_completed ? "Will be issued soon" : null,
      },
      {
        label: "Exam",
        status: !ex ? "pending"
          : ex.status === "submitted" ? "done"
          : ex.status === "started" ? "active"
          : "pending",
        detail: ex?.submitted_at
          ? `Submitted ${new Date(ex.submitted_at).toLocaleDateString()}`
          : null,
      },
      {
        label: "Certificate",
        status: cert ? "done" : "pending",
        detail: cert
          ? `Valid until ${new Date(cert.expiry_date).toLocaleDateString("en-IN")}`
          : null,
      },
    ];
  };

  const statusColor = {
    submitted: "bg-blue-100 text-blue-700",
    eligible: "bg-green-100 text-green-700",
    ineligible: "bg-red-100 text-red-700",
    pending_approval: "bg-amber-100 text-amber-700",
    result_pass: "bg-green-100 text-green-700",
    result_fail: "bg-red-100 text-red-700",
    exam_submitted: "bg-purple-100 text-purple-700",
    certified: "bg-teal-100 text-teal-700",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Award size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {reg.exam_track || reg.custom_cert_name || "Unknown"}
              {reg.is_custom_cert && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  custom
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{reg.drive_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[reg.status] || "bg-gray-100 text-gray-600"}`}>
            {reg.status}
          </span>
          {expanded
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />
          }
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5">
          {/* 9-step tracker */}
          <div className="space-y-3">
            {getSteps().map((step, i) => (
              <div key={i}>
                <TrackerStep {...step} />
                {i < getSteps().length - 1 && (
                  <div className="ml-3.5 w-0.5 h-3 bg-gray-200 my-1" />
                )}
              </div>
            ))}
          </div>

          {/* Slot timing */}
          {reg.slot_datetime && (
            <div className={`rounded-lg px-3 py-2 border text-xs ${
              reg.slot_info?.is_past
                ? "bg-gray-50 border-gray-200 text-gray-500"
                : reg.slot_info?.diff_days < 1
                ? "bg-red-50 border-red-200 text-red-700"
                : reg.slot_info?.diff_days <= 2
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}>
              <span className="font-medium">Exam slot: </span>
              {new Date(reg.slot_datetime).toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit"
              })}
              {!reg.slot_info?.is_past && reg.slot_datetime && (
                <span className="ml-2">
                  · <Countdown slotDatetime={reg.slot_datetime} />
                </span>
              )}
            </div>
          )}

          {/* Action buttons based on stage */}

          {/* Complete Course button */}
          {reg.eligibility?.decision === "eligible" &&
           !reg.course_completed &&
           !reg.voucher && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">
                    Course ready
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    Mark course as completed to generate your voucher
                  </p>
                </div>
              </div>
              {completeError && (
                <p className="text-xs text-red-600">{completeError}</p>
              )}
              <button
                onClick={handleCompleteCourse}
                disabled={completing}
                className="w-full bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {completing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Completing course...
                  </>
                ) : (
                  <>
                    <CheckCircle size={15} />
                    Complete Course
                  </>
                )}
              </button>
            </div>
          )}

          {/* Voucher section */}
          {reg.voucher?.status === "issued" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">
                    Voucher ready
                  </p>
                </div>
                {reg.voucher.days_to_expiry !== null && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    reg.voucher.days_to_expiry <= 3
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    Expires in {reg.voucher.days_to_expiry}d
                  </span>
                )}
              </div>
              <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-between border border-amber-200">
                <span className="font-mono text-sm text-gray-600">
                  {reg.voucher.masked_code}
                </span>
                <span className="text-xs text-gray-400">masked</span>
              </div>
              <a
                href={reg.voucher.tokenized_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2 rounded-lg text-sm hover:bg-amber-700"
              >
                <ExternalLink size={14} />
                Redeem Voucher
              </a>
            </div>
          )}

          {/* Proceed to exam */}
          {(reg.voucher?.status === "redeemed" || reg.voucher?.status === "expired") &&
           !reg.exam_session && (
            <ExamStarter reg={reg} onSuccess={onRefresh} />
          )}

          {/* Exam submitted — awaiting cert */}
          {reg.exam_session?.status === "submitted" && !reg.certificate && (
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-sm text-purple-700 font-medium">
                Exam submitted — certificate being processed
              </p>
            </div>
          )}

          {/* Certificate */}
          {reg.certificate && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-green-600" />
                <p className="text-sm font-semibold text-green-800">
                  Certificate issued
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                  reg.certificate.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {reg.certificate.status}
                </span>
              </div>
              <p className="text-xs text-green-700">
                Valid until: {new Date(reg.certificate.expiry_date).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric"
                })}
              </p>
              <p className="text-xs text-green-600">
                {reg.certificate.days_remaining} days remaining
              </p>
              <button className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">
                <Download size={14} />
                Download Certificate (PDF)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── My Certifications tab ─────────────────────────────────────────────
function MyCertifications() {
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["my-certificates"],
    queryFn: getMyCertificates,
  });

  const filtered = certs.filter(cert => {
    const matchSearch = cert.cert_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = showExpired ? true : cert.status === "active";
    return matchSearch && matchStatus;
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-8"
            placeholder="Search certifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
            showExpired
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          {showExpired ? "Hide expired" : "Show expired"}
        </button>
      </div>

      {!filtered.length ? (
        <div className="card text-center py-10">
          <Award size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? "No certificates match your search" : "No certificates earned yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cert => (
            <div key={cert.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <Award size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{cert.cert_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{cert.drive_name}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  cert.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {cert.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Issued</p>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {new Date(cert.issued_date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                  </p>
                </div>
                <div className={`rounded-lg p-2 ${
                  cert.status === "active" ? "bg-green-50" : "bg-red-50"
                }`}>
                  <p className={cert.status === "active" ? "text-green-600" : "text-red-500"}>
                    {cert.status === "active" ? "Valid until" : "Expired on"}
                  </p>
                  <p className={`font-medium mt-0.5 ${
                    cert.status === "active" ? "text-green-800" : "text-red-700"
                  }`}>
                    {new Date(cert.expiry_date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                  </p>
                </div>
              </div>

              {cert.status === "active" && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-600">
                    {cert.days_remaining} days remaining
                  </p>
                  <button className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                    <Download size={12} />
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

// ── Main candidate dashboard ──────────────────────────────────────────
export default function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("registrations");
  const [dateFilter, setDateFilter] = useState("current_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["candidate-dashboard"],
    queryFn: getCandidateDashboard,
  });

  // Date filtering
  const filterRegistrations = (regs) => {
    if (!regs) return [];
    const now = new Date();

    return regs.filter(reg => {
      const created = new Date(reg.created_at);
      if (dateFilter === "current_month") {
        return created.getMonth() === now.getMonth() &&
               created.getFullYear() === now.getFullYear();
      }
      if (dateFilter === "last_3_months") {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return created >= threeMonthsAgo;
      }
      if (dateFilter === "custom" && customStart && customEnd) {
        return created >= new Date(customStart) &&
               created <= new Date(customEnd + "T23:59:59");
      }
      return true;
    });
  };

  const filteredRegs = filterRegistrations(data?.registrations);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Hi, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your certification journey</p>
        </div>
        <span className="bg-purple-50 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full border border-purple-200">
          Candidate
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "registrations", label: "My Registrations" },
          { id: "certifications", label: "My Certifications" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Registrations tab */}
      {activeTab === "registrations" && (
        <div className="space-y-4">
          {/* Date filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Filter:</span>
            {[
              { id: "current_month", label: "This month" },
              { id: "last_3_months", label: "Last 3 months" },
              { id: "custom", label: "Custom" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  dateFilter === f.id
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                }`}
              >
                {f.label}
              </button>
            ))}
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input text-xs py-1"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  className="input text-xs py-1"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Available drives */}
          {data?.available_drives?.length > 0 && (
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                Open drives — apply now
              </p>
              <div className="space-y-2">
                {data.available_drives.map(d => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.name}</p>
                      {d.end_date && (
                        <p className="text-xs text-gray-500">
                          Closes {new Date(d.end_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("/registrations")}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                    >
                      Apply <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registration cards */}
          {!filteredRegs.length ? (
            <div className="card text-center py-10">
              <Clock size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                No registrations in this period
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRegs.map(reg => (
                <RegistrationCard
                  key={reg.registration_id}
                  reg={reg}
                  onRefresh={() => {
                    qc.invalidateQueries(["candidate-dashboard"]);
                    refetch();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Certifications tab */}
      {activeTab === "certifications" && <MyCertifications />}
    </div>
  );
}