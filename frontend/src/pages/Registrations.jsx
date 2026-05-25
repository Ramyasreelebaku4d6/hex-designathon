import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRegistrations, createRegistration } from "../api/registrations";
import { getDrives } from "../api/drives";
import { Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function StatusBadge({ status }) {
  const map = {
    submitted: "badge-blue",
    eligible: "badge-green",
    ineligible: "badge-red",
    pending_approval: "badge-yellow",
    result_pass: "badge-green",
    result_fail: "badge-red",
  };
  return (
    <span className={map[status] || "badge-gray"}>{status}</span>
  );
}

export default function Registrations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    drive_id: "",
    exam_track: "",
    slot_datetime: "",
    prior_attempts: 0,
  });

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
  });

  const { data: drives = [] } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const activeDrives = drives.filter((d) => d.status === "active");

  const createMutation = useMutation({
    mutationFn: createRegistration,
    onSuccess: () => {
      qc.invalidateQueries(["registrations"]);
      setShowForm(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      prior_attempts: parseInt(form.prior_attempts) || 0,
      slot_datetime: form.slot_datetime
        ? new Date(form.slot_datetime).toISOString()
        : null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Registrations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "candidate"
              ? "Your registrations"
              : "All candidate registrations"}
          </p>
        </div>
        {user?.role === "candidate" && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Register
          </button>
        )}
      </div>

      {/* Register Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Register for Drive</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            {activeDrives.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No active drives available for registration.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Drive *
                  </label>
                  <select
                    className="input"
                    value={form.drive_id}
                    onChange={(e) =>
                      setForm({ ...form, drive_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Choose a drive...</option>
                    {activeDrives.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exam Track
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. AZ-900, DP-100"
                    value={form.exam_track}
                    onChange={(e) =>
                      setForm({ ...form, exam_track: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Slot
                  </label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.slot_datetime}
                    onChange={(e) =>
                      setForm({ ...form, slot_datetime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prior Attempts
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.prior_attempts}
                    onChange={(e) =>
                      setForm({ ...form, prior_attempts: e.target.value })
                    }
                  />
                </div>
                {createMutation.isError && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {createMutation.error?.response?.data?.detail ||
                      "Registration failed"}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {createMutation.isPending ? "Registering..." : "Register"}
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
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No registrations found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Registration ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Exam Track
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Slot
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Registered On
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {reg.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {reg.exam_track || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {reg.slot_datetime
                      ? new Date(reg.slot_datetime).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={reg.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(reg.created_at).toLocaleDateString()}
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