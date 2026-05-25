import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRegistrations } from "../api/registrations";
import { evaluateEligibility, approveEligibility } from "../api/eligibility";
import { useState } from "react";
import { Brain, CheckCircle, XCircle } from "lucide-react";

export default function Eligibility() {
  const qc = useQueryClient();
  const [scores, setScores] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
  });

  const evaluateMutation = useMutation({
    mutationFn: evaluateEligibility,
    onSuccess: (data, regId) => {
      setScores((prev) => ({ ...prev, [regId]: data }));
      qc.invalidateQueries(["registrations"]);
      setLoadingId(null);
    },
    onError: () => setLoadingId(null),
  });

  const approveMutation = useMutation({
    mutationFn: ({ eligId, decision }) =>
      approveEligibility(eligId, { decision }),
    onSuccess: () => qc.invalidateQueries(["registrations"]),
  });

  const handleEvaluate = (regId) => {
    setLoadingId(regId);
    evaluateMutation.mutate(regId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Eligibility</h1>
        <p className="text-gray-500 text-sm mt-1">
          AI-powered eligibility evaluation
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="card text-center text-gray-500">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="card text-center text-gray-500">
            No registrations found.
          </div>
        ) : (
          registrations.map((reg) => (
            <div key={reg.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">
                    {reg.exam_track || "General Track"}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {reg.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      reg.status === "eligible"
                        ? "bg-green-100 text-green-700"
                        : reg.status === "ineligible"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {reg.status}
                  </span>
                  <button
                    onClick={() => handleEvaluate(reg.id)}
                    disabled={loadingId === reg.id}
                    className="btn-primary flex items-center gap-2 text-sm py-1.5"
                  >
                    <Brain size={14} />
                    {loadingId === reg.id ? "Evaluating..." : "AI Evaluate"}
                  </button>
                </div>
              </div>

              {/* AI Score Result */}
              {scores[reg.id] && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                      AI Eligibility Score
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(scores[reg.id].ai_score * 100)}%
                    </span>
                  </div>

                  {/* Score Bar */}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${scores[reg.id].ai_score * 100}%`,
                      }}
                    />
                  </div>

                  {/* Decision */}
                  <div className="flex items-center gap-2 mt-2">
                    {scores[reg.id].decision === "eligible" ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <XCircle size={16} className="text-red-600" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        scores[reg.id].decision === "eligible"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      Decision: {scores[reg.id].decision}
                    </span>
                  </div>

                  {/* Reasons */}
                  <div className="mt-2">
                    <p className="text-xs font-medium text-blue-700 mb-1">
                      AI Reasoning:
                    </p>
                    <p className="text-xs text-blue-600">
                      {scores[reg.id].ai_reasons}
                    </p>
                  </div>

                  {/* Manual Override */}
                  {scores[reg.id].decision === "pending_approval" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            eligId: scores[reg.id].id,
                            decision: "eligible",
                          })
                        }
                        className="flex-1 bg-green-600 text-white text-sm py-1.5 rounded-lg hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          approveMutation.mutate({
                            eligId: scores[reg.id].id,
                            decision: "ineligible",
                          })
                        }
                        className="flex-1 bg-red-600 text-white text-sm py-1.5 rounded-lg hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}