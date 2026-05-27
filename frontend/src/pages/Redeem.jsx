import { useEffect, useState, useRef  } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { redeemVoucher } from "../api/vouchers";
import { CheckCircle, XCircle } from "lucide-react";

export default function Redeem() {
  const { token } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;
    redeemVoucher(token)
      .then((data) => {
        setResult(data);
        // Invalidate dashboard cache so status shows as redeemed immediately on return
        qc.invalidateQueries({ queryKey: ["candidate-dashboard"] });
      })
      .catch((err) =>
        setError(
          err.response?.data?.detail || "Invalid or expired voucher link."
        )
      )
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <XCircle size={56} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Invalid Voucher Link
            </h2>
            <p className="text-gray-500 text-sm">{error}</p>
          </>
        ) : (
          <>
            <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Voucher Redeemed!
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Save this code — this page cannot be revisited.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1">Vendor</p>
              <p className="font-semibold text-gray-800">{result?.vendor}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-blue-600 mb-1">Your Voucher Code</p>
              <p className="text-2xl font-bold text-blue-700 tracking-widest">
                {result?.code}
              </p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-xs text-yellow-700">
                Expires:{" "}
                {result?.expiry_date
                  ? new Date(result.expiry_date).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(result?.code)}
              className="btn-primary w-full mt-4"
            >
              Copy Code
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="btn-secondary w-full mt-2"
            >
              Go to Dashboard
            </button>
          </>
        )}
        <p className="text-xs text-gray-400 mt-6">
          Maverick Certification Hub — Hexaware Technologies
        </p>
      </div>
    </div>
  );
}