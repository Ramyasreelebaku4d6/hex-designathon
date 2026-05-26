import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDrives, createDrive,
  updateDriveStatus, generateDriveVouchers
} from "../api/drives";
import {
  searchCertifications,
  addCertificationToDrive,
} from "../api/certifications";
import { generateSlots } from "../api/slots";
import { Plus, X, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
};

function StatusBadge({ status }) {
  const map = {
    draft: "badge-gray",
    active: "badge-green",
    closed: "badge-red",
  };
  return <span className={map[status] || "badge-gray"}>{status}</span>;
}

export default function Drives() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [certSearch, setCertSearch] = useState("");
  const [certResults, setCertResults] = useState([]);
  const [selectedCerts, setSelectedCerts] = useState([]);
  const [generatingVouchers, setGeneratingVouchers] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [form, setForm] = useState({
    name: "",
    sponsor: "",
    budget: "",
    start_date: "",
    end_date: "",
    policy_url: "",
    pass_threshold: 70,
  });

  const { data: drives = [], isLoading } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const filteredDrives = drives
    .filter(drive => {
      if (statusFilter === "all") return true;
      return drive.status === statusFilter;
    })
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date) - new Date(b.start_date);
    });

  const countByStatus = drives.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  const createMutation = useMutation({ mutationFn: createDrive });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateDriveStatus(id, status),
    onSuccess: () => qc.invalidateQueries(["drives"]),
  });

  const handleCertSearch = async (val) => {
    setCertSearch(val);
    if (val.length < 1) { setCertResults([]); return; }
    try {
      const results = await searchCertifications(val);
      setCertResults(results);
    } catch {
      setCertResults([]);
    }
  };

  const addCertToSelected = (cert) => {
    if (!selectedCerts.find(c => c.id === cert.id)) {
      setSelectedCerts(prev => [...prev, cert]);
    }
    setCertSearch("");
    setCertResults([]);
  };

  const addNewCert = () => {
    if (!certSearch.trim()) return;
    const newCert = { id: "new_" + Date.now(), name: certSearch.trim(), isNew: true };
    if (!selectedCerts.find(c => c.name.toLowerCase() === newCert.name.toLowerCase())) {
      setSelectedCerts(prev => [...prev, newCert]);
    }
    setCertSearch("");
    setCertResults([]);
  };

  const removeCert = (certId) => {
    setSelectedCerts(prev => prev.filter(c => c.id !== certId));
  };

  const resetForm = () => {
    setForm({
      name: "", sponsor: "", budget: "",
      start_date: "", end_date: "",
      policy_url: "", pass_threshold: 70,
    });
    setSelectedCerts([]);
    setCertSearch("");
    setCertResults([]);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const drive = await createMutation.mutateAsync({
        name: form.name,
        sponsor: form.sponsor,
        budget: parseFloat(form.budget) || 0,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        policy_url: form.policy_url,
        pass_threshold: parseFloat(form.pass_threshold) || 70,
      });

      for (const cert of selectedCerts) {
        try {
          if (cert.isNew) {
            await addCertificationToDrive(drive.id, { name: cert.name });
          } else {
            await addCertificationToDrive(drive.id, { cert_id: cert.id });
          }
        } catch (err) {
          console.error("Cert link failed:", cert.name, err);
        }
      }

      if (form.start_date && form.end_date) {
        try { await generateSlots(drive.id); } catch {}
      }

      if (selectedCerts.length > 0 && parseFloat(form.budget) > 0) {
        try {
          setGeneratingVouchers(true);
          await generateDriveVouchers(drive.id);
        } catch (err) {
          console.error("Voucher generation failed:", err);
        } finally {
          setGeneratingVouchers(false);
        }
      }

      qc.invalidateQueries(["drives"]);
      resetForm();
    } catch (err) {
      console.error("Drive creation failed:", err);
    }
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

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Show:</span>
        {[
          { id: "active", label: "Active", color: "bg-green-600" },
          { id: "draft", label: "Draft", color: "bg-gray-500" },
          { id: "closed", label: "Closed", color: "bg-red-500" },
          { id: "all", label: "All", color: "bg-blue-600" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === f.id
                ? `${f.color} text-white border-transparent`
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              statusFilter === f.id
                ? "bg-white bg-opacity-30 text-white"
                : "bg-gray-100 text-gray-600"
            }`}>
              {f.id === "all" ? drives.length : countByStatus[f.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Create Drive Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Drive</h2>
              <button onClick={resetForm}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Drive name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drive Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. AZ-900 Drive Q2 2025"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              {/* Sponsor + Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsor
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Hexaware L&D"
                    value={form.sponsor}
                    onChange={e => setForm({ ...form, sponsor: e.target.value })}
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
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
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
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Pass threshold + Policy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pass Threshold (%)
                  </label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={form.pass_threshold}
                    onChange={e =>
                      setForm({ ...form, pass_threshold: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy URL
                  </label>
                  <input
                    className="input"
                    placeholder="https://..."
                    value={form.policy_url}
                    onChange={e =>
                      setForm({ ...form, policy_url: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Certifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certifications for this drive
                </label>

                {selectedCerts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedCerts.map(cert => (
                      <div
                        key={cert.id}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200"
                      >
                        {cert.name}
                        {cert.isNew && (
                          <span className="text-blue-400 text-xs">(new)</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCert(cert.id)}
                          className="ml-1 hover:text-blue-900"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                      <input
                        className="input pl-8"
                        placeholder="Search existing certifications..."
                        value={certSearch}
                        onChange={e => handleCertSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addNewCert();
                          }
                        }}
                      />
                    </div>
                    {certSearch.trim() && (
                      <button
                        type="button"
                        onClick={addNewCert}
                        className="btn-secondary flex items-center gap-1 text-xs whitespace-nowrap px-3"
                      >
                        <Plus size={12} />
                        Add new
                      </button>
                    )}
                  </div>

                  {certResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                      {certResults.map(cert => (
                        <button
                          key={cert.id}
                          type="button"
                          onClick={() => addCertToSelected(cert)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                        >
                          <span>{cert.name}</span>
                          {cert.code && (
                            <span className="text-xs text-gray-400">{cert.code}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {form.budget && selectedCerts.length > 0 && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                    AI will generate ~{Math.floor(
                      (parseFloat(form.budget) / selectedCerts.length) / 1000
                    )} vouchers per certification
                    ({selectedCerts.length} cert{selectedCerts.length > 1 ? "s" : ""})
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  Search existing or type a new name and click "Add new"
                </p>
              </div>

              {createMutation.isError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {createMutation.error?.response?.data?.detail ||
                    "Failed to create drive"}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending || generatingVouchers}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending
                    ? "Creating drive..."
                    : generatingVouchers
                    ? "Generating vouchers with AI..."
                    : "Create Drive"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
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
        ) : filteredDrives.length === 0 ? (
          <div className="p-8 text-center text-gray-500 space-y-2">
            <p>No {statusFilter === "all" ? "" : statusFilter} drives found.</p>
            {statusFilter !== "all" && (
              <button
                onClick={() => setStatusFilter("all")}
                className="text-xs text-blue-600 hover:underline"
              >
                Show all drives
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Drive Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Sponsor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Start Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">End Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Threshold</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                {["admin", "coordinator"].includes(user?.role) && (
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrives.map(drive => (
                <tr key={drive.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {drive.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.sponsor || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.budget ? `₹${drive.budget.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDate(drive.start_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDate(drive.end_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {drive.pass_threshold ?? 70}%
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
                              statusMutation.mutate({ id: drive.id, status: "active" })
                            }
                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100"
                          >
                            Activate
                          </button>
                        )}
                        {drive.status === "active" && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({ id: drive.id, status: "closed" })
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