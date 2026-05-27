import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEligibilityGrouped, approveEligibility } from "../api/eligibility";
import { CheckCircle, XCircle, Clock, Brain, ChevronDown, ChevronUp } from "lucide-react";

const AI_SCORE_COLOR = (score) => {
  if (score == null) return "text-gray-500";
  if (score >= 0.7) return "text-green-600";
  if (score >= 0.4) return "text-amber-600";
  return "text-red-600";
};

function ScoreBar({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${AI_SCORE_COLOR(score)}`}>{pct}%</span>
    </div>
  );
}

function ApprovedCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  return (
    <div className="bg-white border border-green-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-green-50" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-800 text-sm">{item.candidate_name}</p>
            <p className="text-xs text-gray-500">{item.exam_track || item.custom_cert_name} · {item.drive_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Approved</p>
            <p className="text-xs text-gray-600 font-medium">{formatDate(item.decision_date)}</p>
          </div>
          {item.ai_score != null && (
            <span className={`text-xs font-semibold ${AI_SCORE_COLOR(item.ai_score)}`}>
              {Math.round(item.ai_score * 100)}%
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-green-50 px-4 py-3 bg-green-50 space-y-2">
          <ScoreBar score={item.ai_score} />
          {item.ai_reasons && (
            <p className="text-xs text-gray-600">{item.ai_reasons}</p>
          )}
          <p className="text-xs text-gray-400">{item.candidate_email}</p>
        </div>
      )}
    </div>
  );
}

function RejectedCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  return (
    <div className="bg-white border border-red-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-red-50" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <XCircle size={16} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-800 text-sm">{item.candidate_name}</p>
            <p className="text-xs text-gray-500">{item.exam_track || item.custom_cert_name} · {item.drive_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">Rejected</p>
            <p className="text-xs text-gray-600 font-medium">{formatDate(item.decision_date)}</p>
          </div>
          {item.ai_score != null && (
            <span className={`text-xs font-semibold ${AI_SCORE_COLOR(item.ai_score)}`}>
              {Math.round(item.ai_score * 100)}%
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-red-50 px-4 py-3 bg-red-50 space-y-2">
          <ScoreBar score={item.ai_score} />
          {item.ai_reasons && (
            <p className="text-xs text-gray-600">{item.ai_reasons}</p>
          )}
          <p className="text-xs text-gray-400">{item.candidate_email}</p>
        </div>
      )}
    </div>
  );
}

function ManualApprovalCard({ item, onApprove, onReject, loading }) {
  const [selectedCertId, setSelectedCertId] = useState("");
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState(true);

  const canApprove = item.drive_certifications?.length > 0 ? !!selectedCertId : true;

  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-50" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-800 text-sm">{item.candidate_name}</p>
            <p className="text-xs text-gray-500">
              Requested: <span className="font-medium text-amber-700">{item.custom_cert_name || item.exam_track}</span>
              {" · "}{item.drive_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.ai_score != null && (
            <span className={`text-xs font-semibold ${AI_SCORE_COLOR(item.ai_score)}`}>
              AI {Math.round(item.ai_score * 100)}%
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-amber-100 px-4 py-4 space-y-4">
          {/* AI Assessment */}
          <div className="bg-amber-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-amber-600" />
              <p className="text-xs font-medium text-amber-800">AI Assessment</p>
            </div>
            <ScoreBar score={item.ai_score} />
            {item.ai_reasons && (
              <p className="text-xs text-amber-700">{item.ai_reasons}</p>
            )}
          </div>

          {/* Cert Mapping */}
          {item.drive_certifications?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">
                Map to certification <span className="text-red-500">*</span>
              </p>
              <p className="text-xs text-gray-500">
                Select the closest matching certification from this drive's list to enable voucher allocation.
              </p>
              <select
                className="input text-sm"
                value={selectedCertId}
                onChange={(e) => setSelectedCertId(e.target.value)}
              >
                <option value="">— Select certification —</option>
                {item.drive_certifications.map(cert => (
                  <option key={cert.cert_id} value={cert.cert_id}>{cert.cert_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reason (optional for approve, required for reject) */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-700">Reason / Notes (optional)</p>
            <input
              className="input text-sm"
              placeholder="Add a note for the candidate..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onApprove(item.eligibility_id, selectedCertId, reason)}
              disabled={loading || !canApprove}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <CheckCircle size={14} />
              Approve
            </button>
            <button
              onClick={() => onReject(item.eligibility_id, reason)}
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <XCircle size={14} />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Eligibility() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending_approval");
  const [processingId, setProcessingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["eligibility-grouped"],
    queryFn: getEligibilityGrouped,
  });

  const approveMutation = useMutation({
    mutationFn: ({ eligId, decision, certId, reason }) =>
      approveEligibility(eligId, { decision, cert_id: certId || null, reason }),
    onSuccess: () => {
      qc.invalidateQueries(["eligibility-grouped"]);
      setProcessingId(null);
    },
    onError: () => setProcessingId(null),
  });

  const handleApprove = (eligId, certId, reason) => {
    setProcessingId(eligId);
    approveMutation.mutate({ eligId, decision: "eligible", certId, reason });
  };

  const handleReject = (eligId, reason) => {
    setProcessingId(eligId);
    approveMutation.mutate({ eligId, decision: "ineligible", certId: null, reason });
  };

  const tabs = [
    { id: "pending_approval", label: "Manual Approval", count: data?.pending_approval?.length ?? 0, color: "amber" },
    { id: "eligible", label: "Approved", count: data?.eligible?.length ?? 0, color: "green" },
    { id: "ineligible", label: "Rejected", count: data?.ineligible?.length ?? 0, color: "red" },
  ];

  const tabStyle = (tab) => {
    const isActive = activeTab === tab.id;
    const colors = {
      amber: isActive ? "border-amber-500 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-700",
      green: isActive ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700",
      red: isActive ? "border-red-500 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700",
    };
    return `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${colors[tab.color]}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Eligibility</h1>
        <p className="text-gray-500 text-sm mt-1">
          AI evaluates eligibility automatically on registration. Manual approval required for custom certifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabStyle(tab)}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                tab.color === "amber" ? "bg-amber-100 text-amber-700"
                : tab.color === "green" ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card text-center text-gray-500 py-10">Loading...</div>
      ) : (
        <div className="space-y-3">
          {activeTab === "pending_approval" && (
            data?.pending_approval?.length === 0 ? (
              <div className="card text-center py-10 text-gray-500">
                No registrations awaiting manual approval.
              </div>
            ) : (
              data?.pending_approval?.map(item => (
                <ManualApprovalCard
                  key={item.registration_id}
                  item={item}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  loading={processingId === item.eligibility_id}
                />
              ))
            )
          )}

          {activeTab === "eligible" && (
            data?.eligible?.length === 0 ? (
              <div className="card text-center py-10 text-gray-500">
                No approved registrations yet.
              </div>
            ) : (
              data?.eligible?.map(item => (
                <ApprovedCard key={item.registration_id} item={item} />
              ))
            )
          )}

          {activeTab === "ineligible" && (
            data?.ineligible?.length === 0 ? (
              <div className="card text-center py-10 text-gray-500">
                No rejected registrations yet.
              </div>
            ) : (
              data?.ineligible?.map(item => (
                <RejectedCard key={item.registration_id} item={item} />
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}
