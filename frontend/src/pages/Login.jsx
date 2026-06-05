import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/msalConfig";
import { verifyMicrosoftToken } from "../api/microsoftAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Award, CheckCircle, Zap, Lock,
  TrendingUp, Users, Activity, Brain
} from "lucide-react";

// ── Animation variants ────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

// ── Stat pill ─────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div
      custom={delay}
      variants={fadeUp}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
      style={{
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(255,255,255,0.85)",
        boxShadow: "0 2px 12px rgba(7,23,41,0.06)",
      }}
      whileHover={{ scale: 1.03, y: -2, boxShadow: "0 6px 20px rgba(7,23,41,0.10)" }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
        <Icon size={14} style={{ color }} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-xs font-extrabold text-[#0B1837] leading-none">{value}</p>
        <p className="text-[10px] text-[#8FA3BF] font-semibold mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Mini dashboard card ───────────────────────────────────────────────
function DashboardPreview() {
  const bars = [40, 65, 48, 80, 58, 90, 72];
  const items = [
    { label: "Active Drives", value: "12", color: "#0062CC", bg: "#EBF3FF" },
    { label: "Certified This Month", value: "84", color: "#00A896", bg: "#E0F5F3" },
    { label: "Pending Approvals", value: "7", color: "#D97706", bg: "#FFFBEB" },
  ];

  return (
    <motion.div
      animate={{ y: [0, -9, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.9)",
        boxShadow: "0 8px 40px rgba(7,23,41,0.12), 0 1px 2px rgba(7,23,41,0.04)",
        width: "100%",
        maxWidth: 320,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(221,229,244,0.8)" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}>
            <Activity size={11} className="text-white" />
          </div>
          <span className="text-xs font-bold text-[#0B1837]">CertiQuest Overview</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          Live
        </span>
      </div>

      {/* Stat rows */}
      <div className="px-4 py-3 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[11px] text-[#4A5E7D] font-medium">{item.label}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: item.bg, color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      <div className="px-4 pb-4">
        <p className="text-[9px] text-[#8FA3BF] font-bold uppercase tracking-widest mb-2">Weekly Registrations</p>
        <div className="flex items-end gap-1 h-10">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${h}%`, background: i === bars.length - 1 ? "#0062CC" : "#C8DFFE", borderRadius: 3 }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: 0.6 + i * 0.06, ease: "easeOut" }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── AI badge ──────────────────────────────────────────────────────────
function AIBadge() {
  return (
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.9)",
        boxShadow: "0 4px 16px rgba(0,98,204,0.10)",
        width: "fit-content",
      }}
    >
      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7C3AED,#0062CC)" }}>
        <Brain size={12} className="text-white" />
      </div>
      <div>
        <p className="text-[11px] font-extrabold text-[#0B1837] leading-none">AI Score: 94%</p>
        <p className="text-[9px] text-[#8FA3BF] font-semibold">Eligibility evaluated</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-secondary ml-1 animate-pulse" />
    </motion.div>
  );
}

// ── Main Login ────────────────────────────────────────────────────────
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
      setError(err.response?.data?.detail || "Login failed. Check your credentials.");
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
        result = await instance.loginPopup({ ...loginRequest, prompt: "select_account" });
      } catch (popupErr) {
        await instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
        return;
      }
      if (result) {
        const data = await verifyMicrosoftToken(result.accessToken);
        loginWithToken(data);
        navigate("/dashboard");
      }
    } catch (err) {
      if (err.errorCode === "user_cancelled") setError("Microsoft login was cancelled.");
      else if (err.errorCode === "popup_window_error") setError("Popup was blocked. Please allow popups.");
      else setError(err.response?.data?.detail || err.message || "Microsoft login failed.");
    } finally {
      setMsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden relative" style={{ background: "linear-gradient(145deg, #EEF2FF 0%, #F0F7FF 40%, #E8F5F3 100%)" }}>

      {/* ── Background orbs ─────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-right blue orb */}
        <div className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,98,204,0.13) 0%, transparent 70%)", filter: "blur(1px)" }} />
        {/* Bottom-left teal orb */}
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,168,150,0.11) 0%, transparent 70%)", filter: "blur(1px)" }} />
        {/* Center-top purple accent */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)" }} />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #0062CC 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      {/* ── Left panel — SaaS showcase ───────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] flex-col justify-center px-12 xl:px-16 py-10 relative z-10">
        <motion.div className="max-w-[460px]" variants={stagger} initial="hidden" animate="visible">

          {/* Brand */}
          <motion.div variants={fadeUp} custom={0} className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-glow-md flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}>
              <Shield size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-base font-extrabold text-[#0B1837] tracking-tight leading-none">CertiQuest</p>
              <p className="text-[10px] text-[#8FA3BF] font-bold uppercase tracking-widest mt-0.5">by Hexaware Technologies</p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl xl:text-[44px] font-extrabold text-[#0B1837] leading-[1.15] tracking-tight mb-4">
            Certification<br />
            <span className="gradient-text">Intelligence</span><br />
            Platform
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-sm text-[#4A5E7D] leading-relaxed mb-8 max-w-sm">
            End-to-end MAP drive lifecycle — AI-powered eligibility, automated vouchers, and real-time certification tracking.
          </motion.p>

          {/* Stat pills */}
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-2.5 mb-10">
            <StatPill icon={Award}     value="2,400+"  label="Certified employees"  color="#0062CC" delay={0} />
            <StatPill icon={TrendingUp} value="98.5%"  label="SLA compliance"        color="#00A896" delay={1} />
            <StatPill icon={Brain}     value="AI++"    label="Smart eligibility"     color="#7C3AED" delay={2} />
            <StatPill icon={Users}     value="12 Drives" label="Active this quarter" color="#D97706" delay={3} />
          </motion.div>

          {/* Dashboard preview card + floating AI badge */}
          <motion.div variants={fadeUp} custom={4} className="relative">
            <DashboardPreview />
            <div className="absolute -top-4 -right-4">
              <AIBadge />
            </div>
          </motion.div>

          {/* Feature list */}
          <motion.div variants={fadeUp} custom={5} className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {[
              { icon: Zap,          text: "AI-powered scoring" },
              { icon: CheckCircle,  text: "Auto voucher allocation" },
              { icon: Shield,       text: "Azure SSO + MFA" },
              { icon: Activity,     text: "Live audit trail" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Icon size={13} className="text-primary" strokeWidth={2.5} />
                <span className="text-[12px] text-[#4A5E7D] font-semibold">{text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* ── Right panel — Login form ─────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 }}
        >
          {/* Glass card */}
          <div
            className="rounded-3xl p-8"
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255,255,255,0.85)",
              boxShadow: "0 8px 40px rgba(7,23,41,0.10), 0 1px 3px rgba(7,23,41,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-3 mb-7 justify-center">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}>
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <p className="text-base font-extrabold text-[#0B1837]">CertiQuest</p>
                <p className="text-[9px] text-[#8FA3BF] font-bold uppercase tracking-widest">MAP Platform</p>
              </div>
            </div>

            {/* Form header */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mb-7"
            >
              <h2 className="text-[22px] font-extrabold text-[#0B1837] tracking-tight">Welcome back</h2>
              <p className="text-sm text-[#8FA3BF] mt-1 font-medium">Sign in to your CertiQuest workspace</p>
            </motion.div>

            {/* Microsoft SSO button */}
            <motion.button
              onClick={handleMicrosoftLogin}
              disabled={msLoading}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              whileHover={{ scale: 1.01, boxShadow: "0 4px 16px rgba(7,23,41,0.10)" }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm text-[#0B1837] mb-5 disabled:opacity-60 transition-colors"
              style={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid rgba(221,229,244,0.9)",
                boxShadow: "0 1px 4px rgba(7,23,41,0.06)",
              }}
            >
              {msLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-[#DDE5F4] border-t-primary animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 21 21" className="flex-shrink-0">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
              )}
              <span>{msLoading ? "Signing in..." : "Continue with Hexaware ID"}</span>
            </motion.button>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 mb-5"
            >
              <div className="flex-1 h-px" style={{ background: "rgba(221,229,244,0.8)" }} />
              <span className="text-[10px] text-[#B0C0D8] uppercase tracking-widest font-bold">or</span>
              <div className="flex-1 h-px" style={{ background: "rgba(221,229,244,0.8)" }} />
            </motion.div>

            {/* Form */}
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  className="input text-sm"
                  placeholder="you@hexaware.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  className="input text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl p-3.5"
                  >
                    <span className="text-sm leading-none mt-0.5">⚠</span>
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01, boxShadow: "0 6px 20px rgba(0,98,204,0.35)" }}
                whileTap={{ scale: 0.99 }}
                className="btn-primary w-full py-3 mt-1 disabled:opacity-60 text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock size={14} strokeWidth={2.5} />
                    Sign In
                  </>
                )}
              </motion.button>
            </motion.form>

            {/* SSO hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="mt-5 rounded-xl p-3.5"
              style={{ background: "rgba(235,243,255,0.8)", border: "1px solid rgba(200,223,254,0.7)" }}
            >
              <p className="text-xs text-[#0062CC] text-center leading-relaxed font-semibold">
                Use <strong>Hexaware ID</strong> for seamless Azure MFA single sign-on.
              </p>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="text-center text-[10px] uppercase tracking-widest text-[#B0C0D8] font-bold mt-5"
          >
            Hexaware Technologies — Internal L&D Platform
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
