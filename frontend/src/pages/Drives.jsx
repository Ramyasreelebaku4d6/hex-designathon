import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDrives, createDrive, updateDriveStatus } from "../api/drives";
import { Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function StatusBadge({ status }) {
  const map = {
    draft: "badge-gray",
    active: "badge-green",
    closed: "badge-red",
  };
  return (
    <span className={map[status] || "badge-gray"}>
      {status}
    </span>
  );
}

export default function Drives() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sponsor: "",
    budget: "",
    start_date: "",
    end_date: "",
    policy_url: "",
  });

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const createMutation = useMutation({
    mutationFn: createDrive,
    onSuccess: () => {
      qc.invalidateQueries(["drives"]);
      setShowForm(false);
      setForm({
        name: "",
        sponsor: "",
        budget: "",
        start_date: "",
        end_date: "",
        policy_url: "",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateDriveStatus(id, status),
    onSuccess: () => qc.invalidateQueries(["drives"]),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      budget: parseFloat(form.budget) || 0,
      start_date: form.start_date
        ? new Date(form.start_date).toISOString()
        : null,
      end_date: form.end_date
        ? new Date(form.end_date).toISOString()
        : null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Drives</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage certification drives
          </p>
        </div>
        {["admin", "coordinator"].includes(user?.role) && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            New Drive
          </button>
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Drive</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drive Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. AZ-900 Drive Q2 2025"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsor
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Hexaware L&D"
                    value={form.sponsor}
                    onChange={(e) =>
                      setForm({ ...form, sponsor: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget (₹)
                  </label>
                  <input
                    className="input"
                    type="number"
                    placeholder="50000"
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy URL
                </label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.policy_url}
                  onChange={(e) =>
                    setForm({ ...form, policy_url: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? "Creating..." : "Create Drive"}
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

      {/* Drives Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading drives...</div>
        ) : drives.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No drives found. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Drive Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Sponsor
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Budget
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Start Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                {["admin", "coordinator"].includes(user?.role) && (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drives.map((drive) => (
                <tr key={drive.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {drive.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.sponsor || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.budget
                      ? `₹${drive.budget.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.start_date
                      ? new Date(drive.start_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={drive.status} />
                  </td>
                  {["admin", "coordinator"].includes(user?.role) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {drive.status === "draft" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: drive.id,
                                status: "active",
                              })
                            }
                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100"
                          >
                            Activate
                          </button>
                        )}
                        {drive.status === "active" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: drive.id,
                                status: "closed",
                              })
                            }
                            className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}