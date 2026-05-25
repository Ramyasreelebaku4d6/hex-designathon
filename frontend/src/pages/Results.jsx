import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getResults, createResult } from "../api/results";
import { getRegistrations } from "../api/registrations";
import { Plus, X } from "lucide-react";

export default function Results() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    registration_id: "",
    score: "",
    outcome: "pass",
    exam_date: "",
  });

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: getResults,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
  });

  const createMutation = useMutation({
    mutationFn: createResult,
    onSuccess: () => {
      qc.invalidateQueries(["results"]);
      qc.invalidateQueries(["dashboard-stats"]);
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      score: parseFloat(form.score),
      exam_date: form.exam_date
        ? new Date(form.exam_date).toISOString()
        : null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Assessment Results
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Import and manage exam results
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Import Result
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Import Result</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Registration *
                </label>
                <select
                  className="input"
                  value={form.registration_id}
                  onChange={(e) =>
                    setForm({ ...form, registration_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select registration...</option>
                  {registrations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.exam_track || "General"} — {r.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Score
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="85"
                    value={form.score}
                    onChange={(e) =>
                      setForm({ ...form, score: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outcome
                  </label>
                  <select
                    className="input"
                    value={form.outcome}
                    onChange={(e) =>
                      setForm({ ...form, outcome: e.target.value })
                    }
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Date
                </label>
                <input
                  className="input"
                  type="date"
                  value={form.exam_date}
                  onChange={(e) =>
                    setForm({ ...form, exam_date: e.target.value })
                  }
                />
              </div>
              {createMutation.isError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {createMutation.error?.response?.data?.detail ||
                    "Failed to import result"}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? "Importing..." : "Import"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No results imported yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Registration ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Score
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Outcome
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Exam Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {r.registration_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 font-medium">{r.score}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.outcome === "pass" ? "badge-green" : "badge-red"
                      }
                    >
                      {r.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.exam_date
                      ? new Date(r.exam_date).toLocaleDateString()
                      : "—"}
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