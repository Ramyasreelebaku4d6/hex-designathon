import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVouchers, addVoucherToPool, revokeVoucher } from "../api/vouchers";
import { getDrives } from "../api/drives";
import { Plus, X } from "lucide-react";

export default function Vouchers() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    drive_id: "",
    vendor: "",
    code: "",
    expiry_date: "",
  });

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["vouchers"],
    queryFn: getVouchers,
  });

  const { data: drives = [] } = useQuery({
    queryKey: ["drives"],
    queryFn: getDrives,
  });

  const addMutation = useMutation({
    mutationFn: addVoucherToPool,
    onSuccess: () => {
      qc.invalidateQueries(["vouchers"]);
      setShowForm(false);
      setForm({ drive_id: "", vendor: "", code: "", expiry_date: "" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeVoucher,
    onSuccess: () => qc.invalidateQueries(["vouchers"]),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    addMutation.mutate({
      ...form,
      expiry_date: new Date(form.expiry_date).toISOString(),
    });
  };

  const statusColor = {
    unassigned: "badge-gray",
    issued: "badge-blue",
    redeemed: "badge-green",
    revoked: "badge-red",
    expired: "badge-yellow",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vouchers</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage voucher pool and issuance
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add Voucher
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Voucher to Pool</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drive *
                </label>
                <select
                  className="input"
                  value={form.drive_id}
                  onChange={(e) =>
                    setForm({ ...form, drive_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select drive...</option>
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Microsoft, Pearson VUE"
                  value={form.vendor}
                  onChange={(e) =>
                    setForm({ ...form, vendor: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Code *
                </label>
                <input
                  className="input"
                  placeholder="e.g. AZURE-XXXX-YYYY-ZZZZ"
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date *
                </label>
                <input
                  className="input"
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) =>
                    setForm({ ...form, expiry_date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {addMutation.isPending ? "Adding..." : "Add to Pool"}
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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : vouchers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No vouchers in pool yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Vendor
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Masked Code
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Expiry
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{v.vendor}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {v.masked_code}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.expiry_date
                      ? new Date(v.expiry_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusColor[v.status] || "badge-gray"}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {v.status === "issued" && (
                      <button
                        onClick={() => revokeMutation.mutate(v.id)}
                        className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                      >
                        Revoke
                      </button>
                    )}
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