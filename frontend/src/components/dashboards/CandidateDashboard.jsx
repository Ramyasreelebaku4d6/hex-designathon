import { useQuery } from "@tanstack/react-query";
import { getCandidateDashboard } from "../../api/dashboard";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, Clock, XCircle, Award,
  Gift, AlertTriangle, ChevronRight
} from "lucide-react";

function JourneyStep({ label, status, value }) {
  const map = {
    done: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", line: "bg-green-400" },
    active: { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", line: "bg-gray-200" },
    pending: { icon: Clock, color: "text-gray-400", bg: "bg-gray-100", line: "bg-gray-200" },
    failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-100", line: "bg-red-200" },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={s.color} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${status === "pending" ? "text-gray-400" : "text-gray-800"}`}>
          {label}
        </p>
        {value && (
          <p className="text-xs text-gray-500 mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}

function getJourneySteps(reg) {
  const steps = [
    {
      label: "Registered",
      status: reg ? "done" : "pending",
      value: reg?.created_at ? new Date(reg.created_at).toLocaleDateString() : null,
    },
    {
      label: "Eligibility",
      status: !reg?.eligibility ? "pending"
        : reg.eligibility.decision === "eligible" ? "done"
        : reg.eligibility.decision === "ineligible" ? "failed"
        : "active",
      value: reg?.eligibility?.decision
        ? `${reg.eligibility.decision} — AI score: ${Math.round((reg.eligibility.ai_score ?? 0) * 100)}%`
        : null,
    },
    {
      label: "Assessment",
      status: !reg?.result ? "pending"
        : reg.result.outcome === "pass" ? "done"
        : "failed",
      value: reg?.result
        ? `Score: ${reg.result.score}% — ${reg.result.outcome}`
        : null,
    },
    {
      label: "Voucher",
      status: !reg?.voucher ? "pending"
        : reg.voucher.status === "redeemed" ? "done"
        : reg.voucher.status === "issued" ? "active"
        : "pending",
      value: reg?.voucher?.status === "issued"
        ? `Expires in ${reg.voucher.days_to_expiry} days`
        : reg?.voucher?.status === "redeemed"
        ? "Redeemed"
        : null,
    },
  ];
  return steps;
}

export default function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["candidate-dashboard"],
    queryFn: getCandidateDashboard,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );

  const latest = data?.registrations?.[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Hi, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Your certification journey
          </p>
        </div>
        <span className="bg-purple-50 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-full border border-purple-200">
          Candidate
        </span>
      </div>

      {/* No registrations yet */}
      {!data?.registrations?.length && (
        <div className="card text-center py-10 space-y-3">
          <Award size={44} className="text-gray-300 mx-auto" />
          <p className="text-gray-500 text-sm">
            You haven't registered for any drive yet.
          </p>
          {data?.available_drives?.length > 0 && (
            <button
              onClick={() => navigate("/registrations")}
              className="btn-primary inline-flex items-center gap-2 mt-2"
            >
              Register for a drive
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}

      {/* Latest registration journey */}
      {latest && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">{latest.drive_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {latest.exam_track} · Registered {new Date(latest.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              latest.status === "eligible" ? "bg-green-100 text-green-700" :
              latest.status === "submitted" ? "bg-blue-100 text-blue-700" :
              latest.status?.includes("pass") ? "bg-green-100 text-green-700" :
              latest.status?.includes("fail") ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {latest.status}
            </span>
          </div>

          {/* Journey steps */}
          <div className="space-y-3 pl-1">
            {getJourneySteps(latest).map((step, i) => (
              <div key={i}>
                <JourneyStep {...step} />
                {i < 3 && (
                  <div className="ml-4 w-0.5 h-4 bg-gray-200 my-1"></div>
                )}
              </div>
            ))}
          </div>

          {/* Voucher CTA */}
          {latest.voucher?.status === "issued" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift size={20} className="text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Voucher ready to redeem
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {latest.voucher.vendor} · Expires in {latest.voucher.days_to_expiry} days
                  </p>
                </div>
              </div>
              <a
                href={latest.voucher.tokenized_link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-amber-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                Redeem
              </a>
            </div>
          )}

          {/* Expiry warning */}
          {latest.voucher?.days_to_expiry !== null &&
           latest.voucher?.days_to_expiry <= 7 &&
           latest.voucher?.status === "issued" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-xs text-red-700 font-medium">
                Voucher expires in {latest.voucher.days_to_expiry} days — redeem now!
              </p>
            </div>
          )}

          {/* AI eligibility reasoning */}
          {latest.eligibility?.ai_reasons && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-medium text-blue-800 mb-1">
                AI eligibility assessment
              </p>
              <p className="text-xs text-blue-700">{latest.eligibility.ai_reasons}</p>
            </div>
          )}
        </div>
      )}

      {/* All registrations history */}
      {data?.registrations?.length > 1 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              All my registrations
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Drive</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Track</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.registrations.map((r) => (
                <tr key={r.registration_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{r.drive_name}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{r.exam_track || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status?.includes("pass") ? "bg-green-100 text-green-700" :
                      r.status?.includes("fail") ? "bg-red-100 text-red-700" :
                      r.status === "eligible" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Available drives */}
      {data?.available_drives?.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Open drives — register now
          </h2>
          <div className="space-y-2">
            {data.available_drives.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => navigate("/registrations")}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.name}</p>
                  {d.end_date && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Closes {new Date(d.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}