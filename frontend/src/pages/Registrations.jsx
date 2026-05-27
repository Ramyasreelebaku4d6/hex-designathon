import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createRegistration, getRegistrationsByDrive } from "../api/registrations";
import { getDrives } from "../api/drives";
import { getDriveCertificationsAvailable } from "../api/certifications";
import { checkAlreadyApplied } from "../api/slots";
import { FolderOpen, X, Clock, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const STATUS_STYLES = {
  eligible:         "bg-green-100 text-green-700",
  submitted:        "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  ineligible:       "bg-red-100 text-red-700",
  result_pass:      "bg-green-100 text-green-700",
  result_fail:      "bg-red-100 text-red-700",
};

function DriveRegistrationCard({ drive }) {
  const [expanded, setExpanded] = useState(false);

  const driveStatusBadge = {
    active: "bg-green-100 text-green-700",
    draft:  "bg-gray-100 text-gray-600",
    closed: "bg-red-100 text-red-700",
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{drive.drive_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${driveStatusBadge[drive.drive_status] || "bg-gray-100 text-gray-600"}`}>
                {drive.drive_status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(drive.start_date)} → {formatDate(drive.end_date)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Users size={14} />
            <span className="font-medium text-gray-700">{drive.registration_count}</span>
            <span className="text-gray-400">registered</span>
          </div>
        </div>
        <div className="ml-3">
          {expanded
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {drive.registrations.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No registrations for this drive.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Certification</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Registered On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drive.registrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 text-sm">{reg.user_name}</p>
                      <p className="text-xs text-gray-400">{reg.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-700">{reg.exam_track || "—"}</span>
                        {reg.is_custom_cert && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">custom</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[reg.status] || "bg-gray-100 text-gray-600"}`}>
                        {reg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(reg.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function Registrations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [certs, setCerts] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [customCert, setCustomCert] = useState("");
  const [isOthers, setIsOthers] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState({});

  const isGroupedRole = ["admin", "approver", "coordinator"].includes(user?.role);

  const { data: driveGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["registrations-by-drive"],
    queryFn: getRegistrationsByDrive,
    enabled: isGroupedRole,
  });

  const { data: drives = [] } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const activeDrives = drives.filter(d => d.status === "active");

  // Check applied status for each active drive
  useEffect(() => {
    if (user?.role === "candidate") {
      activeDrives.forEach(async (drive) => {
        try {
          const res = await client.get(`/api/registrations/check/${drive.id}`);
          setAlreadyApplied(prev => ({
            ...prev,
            [drive.id]: res.data.already_applied
          }));
        } catch {}
      });
    }
  }, [activeDrives.length]);

  // Load certs when drive selected
  const handleDriveSelect = async (drive) => {
    setSelectedDrive(drive);
    setSelectedCert(null);
    setIsOthers(false);
    setCustomCert("");
    if (drive) {
      const driveCerts = await getDriveCertificationsAvailable(drive.id);
      setCerts(driveCerts);
    }
  };

  const createMutation = useMutation({
  mutationFn: createRegistration,
  onSuccess: (data) => {
    qc.invalidateQueries(["registrations"]);
    // ── Update applied status immediately ──────────────────────────
    setAlreadyApplied(prev => ({
      ...prev,
      [data.drive_id]: true
    }));
    setShowForm(false);
    setSelectedDrive(null);
    setSelectedCert(null);
    setIsOthers(false);
    setCustomCert("");
  },
});

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDrive) return;

    createMutation.mutate({
      drive_id: selectedDrive.id,
      cert_id: isOthers ? null : selectedCert?.id || null,
      custom_cert_name: isOthers ? customCert : null,
      is_custom_cert: isOthers,
      exam_track: isOthers ? customCert : selectedCert?.name || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {user?.role === "candidate" ? "Open Drives" : "Registrations"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "candidate"
              ? "Active certification drives you can apply to"
              : "All registrations"}
          </p>
        </div>
      </div>

      {/* Candidate: open drives list */}
      {user?.role === "candidate" && (
        <div className="space-y-3">
          {activeDrives.length === 0 ? (
            <div className="card p-10 text-center text-gray-500">
              <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No active drives at the moment. Check back soon.</p>
            </div>
          ) : (
            activeDrives.map(drive => (
              <div key={drive.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{drive.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {drive.end_date
                      ? `Closes ${new Date(drive.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : "No closing date"}
                  </p>
                </div>
                {alreadyApplied[drive.id] ? (
                  <span className="badge-green text-xs px-3 py-1.5">Applied</span>
                ) : (
                  <button
                    onClick={() => {
                      handleDriveSelect(drive);
                      setShowForm(true);
                    }}
                    className="btn-primary text-sm py-1.5 px-3"
                  >
                    Apply
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Registration Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Register for Drive</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Drive selection */}
              {!selectedDrive && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Drive *
                  </label>
                  <select
                    className="input"
                    onChange={(e) => {
                      const drive = activeDrives.find(d => d.id === e.target.value);
                      handleDriveSelect(drive);
                    }}
                    required
                  >
                    <option value="">Choose a drive...</option>
                    {activeDrives
                      .filter(d => !alreadyApplied[d.id])
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {selectedDrive && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-blue-800">
                    {selectedDrive.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSelectedDrive(null); setCerts([]); }}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Certification selection */}
              {selectedDrive && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Certification *
                  </label>
                  {certs.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                      No certifications with available vouchers for this drive. Please contact your admin.
                    </div>
                  ) : (
                  <select
                    className="input"
                    value={isOthers ? "others" : selectedCert?.id || ""}
                    onChange={(e) => {
                      if (e.target.value === "others") {
                        setIsOthers(true);
                        setSelectedCert(null);
                      } else {
                        setIsOthers(false);
                        const cert = certs.find(c => c.id === e.target.value);
                        setSelectedCert(cert || null);
                      }
                    }}
                    required
                  >
                    <option value="">Choose certification...</option>
                    {certs.map(cert => (
                      <option key={cert.id} value={cert.id}>
                        {cert.name} {cert.code ? `(${cert.code})` : ""}
                      </option>
                    ))}
                    <option value="others">Others (specify below)</option>
                  </select>
                  )}

                  {/* Others text box */}
                  {isOthers && (
                    <div className="mt-2">
                      <input
                        className="input"
                        placeholder="Enter your certification name..."
                        value={customCert}
                        onChange={(e) => setCustomCert(e.target.value)}
                        required
                      />
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Clock size={11} />
                        Custom certifications require approver verification
                      </p>
                    </div>
                  )}
                </div>
              )}

              {createMutation.isError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {createMutation.error?.response?.data?.detail || "Registration failed"}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !selectedDrive ||
                    (!selectedCert && !isOthers) ||
                    (isOthers && !customCert)
                  }
                  className="btn-primary flex-1 disabled:opacity-50"
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
          </div>
        </div>
      )}

      {/* Admin/Approver/Coordinator: grouped by drive */}
      {isGroupedRole && (
        <div className="space-y-3">
          {isLoadingGroups ? (
            <div className="card p-8 text-center text-gray-500">Loading registrations...</div>
          ) : driveGroups.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">No drives found.</div>
          ) : (
            driveGroups.map(drive => (
              <DriveRegistrationCard key={drive.drive_id} drive={drive} />
            ))
          )}
        </div>
      )}

    </div>
  );
}