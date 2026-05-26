import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRegistrations, createRegistration } from "../api/registrations";
import { getDrives } from "../api/drives";
import { getDriveCertifications } from "../api/certifications";
import { getDriveSlots, checkAlreadyApplied } from "../api/slots";
import { Plus, X, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

function SlotPicker({ driveId, selectedSlotId, onSelect }) {
  const { data: slots = [] } = useQuery({
    queryKey: ["slots", driveId],
    queryFn: () => getDriveSlots(driveId),
    enabled: !!driveId,
  });

  // Group slots by date
  const grouped = slots.reduce((acc, slot) => {
    const date = new Date(slot.slot_datetime).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short"
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  if (!slots.length) return (
    <p className="text-xs text-gray-400">No slots available for this drive</p>
  );

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {Object.entries(grouped).map(([date, daySlots]) => (
        <div key={date}>
          <p className="text-xs font-medium text-gray-500 mb-1.5">{date}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {daySlots.map(slot => {
              const time = new Date(slot.slot_datetime).toLocaleTimeString(
                "en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }
              );
              const isSelected = selectedSlotId === slot.id;
              const isBooked = slot.is_booked;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={isBooked}
                  onClick={() => !isBooked && onSelect(slot)}
                  className={`text-xs py-1.5 px-1 rounded-lg border transition-all text-center ${
                    isBooked
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200"
                      : isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [alreadyApplied, setAlreadyApplied] = useState({});

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: getRegistrations,
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
    setSelectedSlot(null);
    if (drive) {
      const driveCerts = await getDriveCertifications(drive.id);
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
    setSelectedSlot(null);
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
      slot_id: selectedSlot?.id || null,
      slot_datetime: selectedSlot?.slot_datetime || null,
    });
  };

  // Helper for slot color coding
  function getSlotColor(slotDatetime, status) {
    // Completed or rejected → grey
    const greyStatuses = [
      "ineligible", "result_fail", "closed", "cancelled"
    ];
    if (greyStatuses.includes(status)) {
      return {
        bg: "bg-gray-100",
        text: "text-gray-400",
        border: "border-gray-200",
        label: "completed"
      };
    }

    if (!slotDatetime) return null;

    const now = new Date();
    const slot = new Date(slotDatetime);
    const diffMs = slot - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      // Past slot
      return {
        bg: "bg-gray-100",
        text: "text-gray-400",
        border: "border-gray-200",
        label: "elapsed"
      };
    } else if (diffDays < 1) {
      // Less than 1 day — RED urgent
      return {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        label: "today"
      };
    } else if (diffDays <= 2) {
      // Between 1 and 2 days — AMBER warning
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        label: "tomorrow"
      };
    } else {
      // More than 2 days — GREEN safe
      return {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
        label: "upcoming"
      };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Registrations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "candidate" ? "Your registrations" : "All registrations"}
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

      {/* Available drives for candidate */}
      {user?.role === "candidate" && activeDrives.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-600">Open drives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeDrives.map(drive => (
              <div key={drive.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{drive.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {drive.end_date
                      ? `Closes ${new Date(drive.end_date).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {alreadyApplied[drive.id] ? (
                  <span className="badge-green text-xs px-3 py-1.5">Applied</span>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedDrive(drive);
                      handleDriveSelect(drive);
                      setShowForm(true);
                    }}
                    className="btn-primary text-sm py-1.5 px-3"
                  >
                    Apply
                  </button>
                )}
              </div>
            ))}
          </div>
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

              {/* Slot picker */}
              {selectedDrive && (selectedCert || (isOthers && customCert)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Exam Slot *
                  </label>
                  <SlotPicker
                    driveId={selectedDrive.id}
                    selectedSlotId={selectedSlot?.id}
                    onSelect={setSelectedSlot}
                  />
                  {selectedSlot && (
                    <div className="mt-2 bg-green-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-700 font-medium">
                        Selected: {new Date(selectedSlot.slot_datetime).toLocaleString("en-IN", {
                          weekday: "short", day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit"
                        })}
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
                    (isOthers && !customCert) ||
                    !selectedSlot
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

      {/* Registrations table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No registrations found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-sm">
                  Certification
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-sm">
                  Exam Slot
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-sm">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-sm text-center">
                  Attempts
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-sm">
                  Registered On
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map(reg => {
                const slotColor = getSlotColor(reg.slot_datetime, reg.status);
                const isCompleted = [
                  "ineligible", "result_fail", "closed", "cancelled"
                ].includes(reg.status);

                return (
                  <tr
                    key={reg.id}
                    className={`hover:bg-gray-50 ${isCompleted ? "opacity-60" : ""}`}
                  >
                    {/* Certification */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCompleted ? "text-gray-400" : "text-gray-800"}`}>
                          {reg.exam_track || "—"}
                        </span>
                        {reg.is_custom_cert && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            custom
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Slot timing with color */}
                    <td className="px-4 py-3">
                      {reg.slot_datetime ? (
                        <div className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border ${
                          slotColor
                            ? `${slotColor.bg} ${slotColor.border}`
                            : "bg-gray-50 border-gray-200"
                        }`}>
                          <span className={`text-xs font-medium ${
                            slotColor ? slotColor.text : "text-gray-500"
                          }`}>
                            {new Date(reg.slot_datetime).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                          <span className={`text-xs ${
                            slotColor ? slotColor.text : "text-gray-400"
                          }`}>
                            {new Date(reg.slot_datetime).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            })}
                            {slotColor?.label && (
                              <span className="ml-1.5 opacity-70">
                                · {slotColor.label}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isCompleted
                          ? "bg-gray-100 text-gray-400"
                          : reg.status === "eligible"
                          ? "bg-green-100 text-green-700"
                          : reg.status === "submitted"
                          ? "bg-blue-100 text-blue-700"
                          : reg.status === "pending_approval"
                          ? "bg-amber-100 text-amber-700"
                          : reg.status?.includes("pass")
                          ? "bg-green-100 text-green-700"
                          : reg.status?.includes("fail")
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {reg.status}
                      </span>
                    </td>

                    {/* Prior attempts */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${
                        isCompleted ? "text-gray-400" : "text-gray-700"
                      }`}>
                        {reg.prior_attempts ?? 0}
                      </span>
                    </td>

                    {/* Registered date */}
                    <td className="px-4 py-3">
                      <span className={`text-xs ${
                        isCompleted ? "text-gray-400" : "text-gray-500"
                      }`}>
                        {new Date(reg.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}