import { useQuery } from "@tanstack/react-query";
import { getApproverDashboard } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Brain } from "lucide-react";

export default function ApproverDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["approver-dashboard"],
    queryFn: getApproverDashboard,
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

      {/* Pending approvals list */}
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
          <div className="space-y-3">
            {stats.pending_queue.map((item) => (
              <div key={item.eligibility_id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{item.candidate_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.candidate_email}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })
                      : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">
                    {item.exam_track || item.custom_cert_name || "—"}
                  </span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {item.drive_name}
                  </span>
                  {item.is_custom_cert && (
                    <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200">
                      Custom cert
                    </span>
                  )}
                </div>

                {item.ai_score !== null && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Brain size={13} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-800">AI Score</span>
                      </div>
                      <span className="text-sm font-bold text-blue-600">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}