import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApproverDashboard } from "../../api/dashboard";
import { approveEligibility } from "../../api/eligibility";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, XCircle, Brain } from "lucide-react";
import { useState } from "react";

export default function ApproverDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deciding, setDeciding] = useState(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["approver-dashboard"],
    queryFn: getApproverDashboard,
  });

  const approveMutation = useMutation({
    mutationFn: ({ eligId, decision }) =>
      approveEligibility(eligId, { decision }),
    onSuccess: () => {
      qc.invalidateQueries(["approver-dashboard"]);
      setDeciding(null);
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Approver Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome, {user?.name} — your approval queue
          </p>
        </div>
        <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200">
          Approver
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-600">
            {stats?.pending_count ?? 0}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Approved this month</p>
          <p className="text-3xl font-bold text-green-600">
            {stats?.approved_this_month ?? 0}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Rejected this month</p>
          <p className="text-3xl font-bold text-red-500">
            {stats?.rejected_this_month ?? 0}
          </p>
        </div>
      </div>

      {/* Approval queue */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Pending approvals ({stats?.pending_count ?? 0})
        </h2>

        {!stats?.pending_queue?.length ? (
          <div className="card text-center py-10">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              All caught up — no pending approvals
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.pending_queue.map((item) => (
              <div key={item.eligibility_id} className="card space-y-3">
                {/* Candidate info */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {item.candidate_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.exam_track} · {item.drive_name} · {item.business_unit}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>

                {/* AI score */}
                {item.ai_score !== null && (
                  <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-800">
                          AI eligibility score
                        </span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        {Math.round((item.ai_score ?? 0) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{ width: `${(item.ai_score ?? 0) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-700">{item.ai_reasons}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setDeciding(item.eligibility_id);
                      approveMutation.mutate({
                        eligId: item.eligibility_id,
                        decision: "eligible",
                      });
                    }}
                    disabled={approveMutation.isPending && deciding === item.eligibility_id}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={15} />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setDeciding(item.eligibility_id);
                      approveMutation.mutate({
                        eligId: item.eligibility_id,
                        decision: "ineligible",
                      });
                    }}
                    disabled={approveMutation.isPending && deciding === item.eligibility_id}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white text-sm py-2 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <XCircle size={15} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}