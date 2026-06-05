import { useQuery } from "@tanstack/react-query";
import { getApproverDashboard } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { CheckCircle, Brain, Clock, ThumbsUp, ThumbsDown } from "lucide-react";

function StatPill({ label, value, color, bgColor, borderColor }) {
  return (
    <div
      className="card text-center hover:-translate-y-0.5 transition-all duration-300"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <p className="section-label mb-2">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight" style={{ color }}>{value}</p>
    </div>
  );
}

export default function ApproverDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["approver-dashboard"],
    queryFn: getApproverDashboard,
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
      <p className="text-xs text-[#8FA3BF] font-semibold uppercase tracking-widest">Loading queue...</p>
    </div>
  );

  return (
    <div className="space-y-7 animate-fade-in">
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Approver Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <span className="font-bold text-[#0B1837]">{user?.name}</span> — manual approval queues
          </p>
        </div>
        <span className="badge-yellow px-4 py-1.5 uppercase tracking-widest text-[10px] font-bold">
          Approver
        </span>
      </div>

      {/* ── Stats ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">
        <StatPill
          label="Pending Approvals"
          value={stats?.pending_count ?? 0}
          color="#D97706"
        />
        <StatPill
          label="Approved This Month"
          value={stats?.approved_this_month ?? 0}
          color="#00A896"
        />
        <StatPill
          label="Rejected This Month"
          value={stats?.rejected_this_month ?? 0}
          color="#F87171"
        />
      </div>

      {/* ── Queue ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="section-label">Pending Approvals Queue</p>
            {(stats?.pending_count ?? 0) > 0 && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#FFFBEB", color: "#D97706", border: "1.5px solid #FDE68A" }}
              >
                {stats.pending_count}
              </span>
            )}
          </div>
        </div>

        {!stats?.pending_queue?.length ? (
          <div className="card flex flex-col items-center justify-center py-14 border-dashed border-2">
            <div className="w-14 h-14 rounded-2xl bg-[#E0F5F3] flex items-center justify-center mb-4">
              <CheckCircle size={26} className="text-secondary" strokeWidth={2} />
            </div>
            <p className="text-[#0B1837] font-bold text-base">All caught up!</p>
            <p className="text-[#8FA3BF] text-sm mt-1 font-medium">No pending approvals in the queue.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.pending_queue.map((item) => (
              <div
                key={item.eligibility_id}
                className="card hover:border-[#B8CCEB] hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
              >
                {/* Candidate header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0062CC, #00A896)" }}
                    >
                      {item.candidate_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-bold text-[#0B1837] text-[15px]">{item.candidate_name}</p>
                      <p className="text-xs text-[#8FA3BF] font-medium mt-0.5">{item.candidate_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-[#8FA3BF]" />
                    <span className="text-xs text-[#8FA3BF] font-semibold">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric"
                          })
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="badge-blue uppercase text-[9px] px-2.5 py-0.5 font-bold tracking-wide">
                    {item.exam_track || item.custom_cert_name || "—"}
                  </span>
                  <span className="badge-gray text-[10px] px-2.5 py-0.5 font-semibold">
                    {item.drive_name}
                  </span>
                  {item.is_custom_cert && (
                    <span className="badge-yellow uppercase text-[9px] px-2.5 py-0.5 font-bold">
                      Custom track
                    </span>
                  )}
                </div>

                {/* AI evaluation */}
                {item.ai_score !== null && (
                  <div
                    className="rounded-xl p-4 border space-y-3"
                    style={{ background: "#F2F5FC", borderColor: "#DDE5F4" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#EBF3FF] flex items-center justify-center">
                          <Brain size={13} className="text-primary" />
                        </div>
                        <span className="text-xs font-bold text-[#4A5E7D] uppercase tracking-widest">
                          AI Evaluation
                        </span>
                      </div>
                      <span
                        className="text-sm font-extrabold px-3 py-0.5 rounded-full"
                        style={{
                          background: (item.ai_score ?? 0) >= 0.7 ? "#E0F5F3" : "#FFFBEB",
                          color: (item.ai_score ?? 0) >= 0.7 ? "#008A7C" : "#D97706",
                        }}
                      >
                        {Math.round((item.ai_score ?? 0) * 100)}%
                      </span>
                    </div>

                    <div className="h-1.5 bg-[#DDE5F4] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(item.ai_score ?? 0) * 100}%`,
                          background: (item.ai_score ?? 0) >= 0.7
                            ? "linear-gradient(90deg, #00A896, #0062CC)"
                            : "linear-gradient(90deg, #F59E0B, #EF4444)",
                        }}
                      />
                    </div>

                    {item.ai_reasons && (
                      <p className="text-xs text-[#4A5E7D] leading-relaxed font-medium">{item.ai_reasons}</p>
                    )}
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
