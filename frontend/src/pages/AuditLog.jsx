import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuditLogs, nlQuery, draftEmail } from "../api/audit";
import { getRegistrations } from "../api/registrations";
import { Brain, Mail, Search } from "lucide-react";

export default function AuditLog() {
  const [question, setQuestion] = useState("");
  const [nlResult, setNlResult] = useState(null);
  const [selectedRegId, setSelectedRegId] = useState("");
  const [emailContext, setEmailContext] = useState("");
  const [emailDraft, setEmailDraft] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => getAuditLogs(),
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
  });

  const nlMutation = useMutation({
    mutationFn: () => nlQuery(question),
    onSuccess: (data) => setNlResult(data),
  });

  const emailMutation = useMutation({
    mutationFn: () => draftEmail(selectedRegId, emailContext),
    onSuccess: (data) => setEmailDraft(data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Audit & AI Tools</h1>
        <p className="text-gray-500 text-sm mt-1">
          Natural language queries and email drafting
        </p>
      </div>

      {/* AI Feature 1 — NL Query */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-primary" />
          <h2 className="text-base font-semibold text-gray-800">
            Ask Anything (AI Query)
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          Ask questions about your data in plain English. Powered by GPT-5.4-mini.
        </p>
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="e.g. How many candidates passed this month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nlMutation.mutate()}
          />
          <button
            onClick={() => nlMutation.mutate()}
            disabled={nlMutation.isPending || !question}
            className="btn-primary flex items-center gap-2"
          >
            <Search size={16} />
            {nlMutation.isPending ? "Thinking..." : "Ask"}
          </button>
        </div>

        {/* Quick questions */}
        <div className="flex flex-wrap gap-2">
          {[
            "How many candidates registered?",
            "How many vouchers are unassigned?",
            "How many candidates passed?",
            "Show all eligible candidates",
          ].map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuestion(q);
                setTimeout(() => nlMutation.mutate(), 100);
              }}
              className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100"
            >
              {q}
            </button>
          ))}
        </div>

        {/* NL Result */}
        {nlResult && (
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800">
              {nlResult.answer}
            </p>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">
                Generated SQL:
              </p>
              <code className="text-xs text-gray-700 font-mono">
                {nlResult.sql}
              </code>
            </div>
            {nlResult.data && nlResult.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      {Object.keys(nlResult.data[0]).map((k) => (
                        <th
                          key={k}
                          className="text-left px-2 py-1 text-blue-700 font-medium"
                        >
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nlResult.data.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-blue-100">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-2 py-1 text-blue-600">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Feature 2 — Email Drafter */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-primary" />
          <h2 className="text-base font-semibold text-gray-800">
            AI Email Drafter
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          Generate personalized follow-up emails for candidates using AI.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Registration
            </label>
            <select
              className="input"
              value={selectedRegId}
              onChange={(e) => setSelectedRegId(e.target.value)}
            >
              <option value="">Choose registration...</option>
              {registrations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.exam_track || "General"} — {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Context
            </label>
            <input
              className="input"
              placeholder="e.g. Voucher issued, follow up needed"
              value={emailContext}
              onChange={(e) => setEmailContext(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => emailMutation.mutate()}
          disabled={emailMutation.isPending || !selectedRegId}
          className="btn-primary flex items-center gap-2"
        >
          <Mail size={16} />
          {emailMutation.isPending ? "Drafting..." : "Draft Email with AI"}
        </button>

        {/* Email Draft Result */}
        {emailDraft && (
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">
                Subject:
              </p>
              <p className="text-sm font-medium text-green-800">
                {emailDraft.subject}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">Body:</p>
              <p className="text-sm text-green-800 whitespace-pre-line">
                {emailDraft.body}
              </p>
            </div>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`
                )
              }
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
            >
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            Audit Trail
          </h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No audit logs yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Time
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Entity
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Action
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Entity ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-blue">{log.entity_type}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {log.entity_id?.slice(0, 8)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}