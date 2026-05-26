import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/msalConfig";
import { verifyMicrosoftToken } from "../api/microsoftAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const { login, loginWithToken } = useAuth();
  const { instance } = useMsal();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Login failed. Check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
  setMsLoading(true);
  setError("");
  try {
    let result;
    try {
      // Try popup first
      result = await instance.loginPopup({
        ...loginRequest,
        prompt: "select_account",
      });
    } catch (popupErr) {
      console.warn("[MS-AUTH] Popup failed, trying redirect:", popupErr);
      // Fallback to redirect if popup blocked
      await instance.loginRedirect({
        ...loginRequest,
        prompt: "select_account",
      });
      return; // redirect will handle the rest
    }

    if (result) {
      console.log("[MS-AUTH] Login result:", result);
      const data = await verifyMicrosoftToken(result.accessToken);
      loginWithToken(data);
      navigate("/dashboard");
    }
  } catch (err) {
    console.error("[MS-AUTH] Error:", err);
    if (err.errorCode === "user_cancelled") {
      setError("Microsoft login was cancelled.");
    } else if (err.errorCode === "popup_window_error") {
      setError("Popup was blocked. Please allow popups for localhost:5173.");
    } else {
      setError(err.response?.data?.detail || err.message || "Microsoft login failed.");
    }
  } finally {
    setMsLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Maverick Hub</h1>
          <p className="text-gray-500 text-sm mt-1">
            MAP Certification Drive Platform
          </p>
        </div>

        {/* Microsoft Login */}
        <button
          onClick={handleMicrosoftLogin}
          disabled={msLoading}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-3 px-4 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {msLoading
              ? "Signing in with Microsoft..."
              : "Sign in with Microsoft (Hexaware ID)"}
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400">or sign in with email</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-4 bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-700 text-center">
            Use <strong>Sign in with Microsoft</strong> for Hexaware SSO
            with MFA authentication.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Hexaware Technologies — Internal Platform
        </p>
      </div>
    </div>
  );
}