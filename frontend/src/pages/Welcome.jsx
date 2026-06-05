import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Brain, ShieldCheck, FolderOpen,
  Award, LogIn, Zap, Users, TrendingUp,
  CheckCircle, Shield, Activity, ChevronRight,
} from "lucide-react";

// ── Animation helpers ─────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] },
});

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.10, delayChildren: 0.15 } },
};

const cardVariant = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// ── Data ──────────────────────────────────────────────────────────────
const features = [
  {
    icon: FolderOpen,
    title: "Drive Lifecycle Management",
    desc: "Create MAP drives for AZ-900, AZ-305, DP-100 and more. Set budget, exam slots and approver workflows — all from one coordinated workspace.",
    accent: "#0062CC",
    bg: "#EBF3FF",
    border: "#C8DFFE",
    dark: false,
  },
  {
    icon: Brain,
    title: "AI Eligibility Engine",
    desc: "Our AI scores every candidate's profile against configurable rules. Approvers only review edge cases — cutting decision time by over 90%.",
    accent: "#7C3AED",
    bg: "#EEF2FF",
    border: "#C7D2FE",
    dark: false,
  },
  {
    icon: Shield,
    title: "Secure Voucher Delivery",
    desc: "Tokenized one-per-candidate vouchers prevent code sharing. Unused budget is automatically refunded and every redemption is audited in real time.",
    accent: "#FFFFFF",
    bg: "transparent",
    border: "rgba(255,255,255,0.12)",
    dark: true,
  },
];

const processSteps = [
  {
    step: "01",
    title: "Coordinator Creates the Drive",
    desc: "Set exam tracks (AZ-900, DP-100…), budget, registration window and slot schedule. Add vouchers per certification track.",
    icon: FolderOpen,
    color: "#0062CC",
    bg: "#EBF3FF",
  },
  {
    step: "02",
    title: "AI Screens & Approves Candidates",
    desc: "Employee registers → AI scores profile → Eligible candidates are notified automatically. Approvers only handle flagged edge cases.",
    icon: Brain,
    color: "#7C3AED",
    bg: "#EEF2FF",
  },
  {
    step: "03",
    title: "Certified & Fully Tracked",
    desc: "Voucher issued → Employee redeems and takes exam → Certificate uploaded → Tracked and renewed until expiry. Complete audit trail.",
    icon: Award,
    color: "#00A896",
    bg: "#E0F5F3",
  },
];

const stats = [
  { value: "2,400+", label: "Employees Certified",    icon: Award },
  { value: "98.5%",  label: "SLA Compliance",         icon: TrendingUp },
  { value: "10×",    label: "Faster than Excel",       icon: Zap },
  { value: "Zero",   label: "Spreadsheet Dependencies",icon: CheckCircle },
];

// ── Component ─────────────────────────────────────────────────────────
export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "linear-gradient(150deg, #F0F5FF 0%, #EEF2FF 40%, #E8F5F3 100%)" }}
    >
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,98,204,0.10) 0%, transparent 68%)" }} />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,168,150,0.09) 0%, transparent 68%)" }} />
        <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 68%)" }} />
        <div className="absolute inset-0 opacity-[0.022]"
          style={{ backgroundImage: "radial-gradient(circle, #0062CC 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
      </div>

      {/* ══════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════ */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-50 px-6 py-4"
      >
        <div
          className="mx-auto max-w-7xl flex items-center justify-between rounded-2xl px-5 py-3"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(221,229,244,0.9)",
            boxShadow: "0 2px 16px rgba(7,23,41,0.07)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}
            >
              <ShieldCheck size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[15px] font-extrabold text-[#0B1837] tracking-tight leading-none">CertiQuest</p>
              <p className="text-[9px] text-[#8FA3BF] font-bold uppercase tracking-widest mt-0.5">
                by Hexaware Technologies
              </p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {["Features", "How It Works", "About MAP"].map(link => (
              <span key={link} className="text-sm font-semibold text-[#4A5E7D] hover:text-[#0062CC] cursor-pointer transition-colors">
                {link}
              </span>
            ))}
          </nav>

          {/* CTA */}
          <motion.button
            onClick={() => navigate("/login")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: "linear-gradient(135deg,#0062CC,#0074E8)",
              boxShadow: "0 2px 10px rgba(0,98,204,0.28)",
            }}
          >
            <LogIn size={14} strokeWidth={2.5} />
            Sign In
          </motion.button>
        </div>
      </motion.header>

      {/* ══════════════════════════════════════════════
          HERO + FEATURES
      ══════════════════════════════════════════════ */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-14 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-16 xl:gap-20">

          {/* ── Left: Hero copy ──────────────────────── */}
          <motion.section
            className="flex-1 space-y-8 max-w-xl"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Badge */}
            <motion.div variants={cardVariant}>
              <div
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(0,98,204,0.20)",
                  color: "#0062CC",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 2px 10px rgba(0,98,204,0.10)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: "linear-gradient(135deg,#0062CC,#00A896)" }}
                />
                MAP — Maverick Accreditation Program · Hexaware L&D
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div variants={cardVariant} className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0B1837] leading-[1.12] tracking-tight">
                Automate your<br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg,#0062CC,#00A896)" }}
                >
                  entire MAP certification
                </span><br />
                lifecycle.
              </h1>
              <p className="text-[17px] text-[#4A5E7D] leading-relaxed font-medium max-w-md">
                CertiQuest replaces error-prone Excel sheets with an intelligent platform that manages drives, AI-screens candidates, delivers secure vouchers, and tracks certifications — end to end.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div variants={cardVariant} className="flex flex-wrap gap-3">
              <motion.button
                onClick={() => navigate("/login")}
                whileHover={{ scale: 1.02, boxShadow: "0 6px 22px rgba(0,98,204,0.36)" }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white"
                style={{ background: "linear-gradient(135deg,#0062CC,#0074E8)", boxShadow: "0 3px 12px rgba(0,98,204,0.28)" }}
              >
                <LogIn size={15} /> Get Started
              </motion.button>
              <motion.button
                onClick={() => navigate("/login")}
                whileHover={{ scale: 1.01, backgroundColor: "#EBF3FF" }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-[#0062CC] border border-[#C8DFFE] bg-white/80 transition-colors"
                style={{ boxShadow: "0 1px 4px rgba(7,23,41,0.05)" }}
              >
                How It Works <ArrowRight size={15} />
              </motion.button>
            </motion.div>

            {/* Social proof strip */}
            <motion.div
              variants={cardVariant}
              className="flex flex-wrap items-center gap-5"
            >
              {[
                { icon: Users,      text: "2,400+ certified" },
                { icon: Activity,   text: "Real-time tracking" },
                { icon: ShieldCheck, text: "Azure SSO secured" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-sm text-[#4A5E7D] font-semibold">
                  <Icon size={14} className="text-[#0062CC]" strokeWidth={2.5} />
                  {text}
                </div>
              ))}
            </motion.div>

            {/* Feature cards */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid gap-4 sm:grid-cols-3 pt-2"
            >
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  variants={cardVariant}
                  whileHover={{ y: -4, boxShadow: f.dark ? "0 10px 32px rgba(7,23,41,0.22)" : "0 8px 28px rgba(7,23,41,0.10)" }}
                  className="rounded-2xl p-5 cursor-default transition-shadow duration-300"
                  style={f.dark ? {
                    background: "linear-gradient(145deg,#071729,#0C2444)",
                    border: `1px solid ${f.border}`,
                    boxShadow: "0 2px 12px rgba(7,23,41,0.18)",
                  } : {
                    background: "rgba(255,255,255,0.88)",
                    border: `1px solid ${f.border}`,
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 2px 12px rgba(7,23,41,0.06)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={f.dark
                      ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }
                      : { background: f.bg, border: `1.5px solid ${f.border}` }
                    }
                  >
                    <f.icon size={18} style={{ color: f.dark ? "#fff" : f.accent }} strokeWidth={2} />
                  </div>
                  <h3 className={`text-sm font-bold leading-snug mb-2 ${f.dark ? "text-white" : "text-[#0B1837]"}`}>
                    {f.title}
                  </h3>
                  <p className={`text-xs leading-relaxed font-medium ${f.dark ? "text-[#7AAAD4]" : "text-[#4A5E7D]"}`}>
                    {f.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* ── Right: Process showcase ──────────────── */}
          <motion.section
            className="flex-1 mt-14 lg:mt-0 max-w-md xl:max-w-lg"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                boxShadow: "0 12px 48px rgba(7,23,41,0.14), 0 2px 6px rgba(7,23,41,0.05)",
              }}
            >
              {/* Dark nav panel header */}
              <div
                className="relative px-6 py-5 overflow-hidden"
                style={{ background: "linear-gradient(135deg, #071729 0%, #0C2444 60%, #0F3060 100%)" }}
              >
                {/* Dot grid */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                {/* Glow */}
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(0,98,204,0.18) 0%, transparent 70%)" }} />

                <div className="relative flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={13} className="text-[#4DA8FF]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4DA8FF]">CertiQuest</p>
                    </div>
                    <p className="text-base font-extrabold text-white tracking-tight">MAP Drive Lifecycle</p>
                    <p className="text-xs text-[#7AAAD4] font-medium mt-0.5">From registration to certification — automated.</p>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(0,168,150,0.18)", border: "1px solid rgba(0,168,150,0.30)" }}
                  >
                    <Activity size={18} className="text-[#4ECDC4]" />
                  </div>
                </div>

                {/* Quick stat row on dark bg */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "12",   l: "Active Drives",   c: "#4DA8FF" },
                    { v: "84",   l: "Certified / Mo",  c: "#4ECDC4" },
                    { v: "98%",  l: "SLA Compliance",  c: "#FCD34D" },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl px-3 py-2.5 text-center"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      <p className="text-lg font-extrabold" style={{ color: s.c }}>{s.v}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.40)" }}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Light body — process steps */}
              <div className="bg-white px-6 py-5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8FA3BF] mb-4">
                  How a MAP drive flows
                </p>

                {processSteps.map((step, i) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.12, duration: 0.45, ease: "easeOut" }}
                    whileHover={{ x: 3 }}
                    className="flex gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-default"
                    style={{ borderColor: "#F0F4FA", background: "#FAFBFF" }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: step.bg, border: `1.5px solid ${step.color}28` }}
                    >
                      <step.icon size={17} style={{ color: step.color }} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
                          style={{ background: step.bg, color: step.color }}
                        >
                          {step.step}
                        </span>
                        <p className="text-sm font-bold text-[#0B1837] truncate">{step.title}</p>
                      </div>
                      <p className="text-xs text-[#4A5E7D] leading-relaxed font-medium">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}

                {/* CTA inside card */}
                <motion.button
                  onClick={() => navigate("/login")}
                  whileHover={{ scale: 1.01, boxShadow: "0 4px 16px rgba(0,98,204,0.25)" }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white mt-2 transition-all"
                  style={{ background: "linear-gradient(135deg,#0062CC,#00A896)", boxShadow: "0 2px 10px rgba(0,98,204,0.22)" }}
                >
                  Access CertiQuest Platform
                  <ChevronRight size={15} strokeWidth={2.5} />
                </motion.button>
              </div>

              {/* Dark stats footer */}
              <div
                className="grid grid-cols-4 divide-x"
                style={{
                  background: "#071729",
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  divideColor: "rgba(255,255,255,0.07)",
                }}
              >
                {stats.map(({ value, label, icon: Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center gap-1 py-4 px-2 text-center"
                    style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <Icon size={13} className="text-[#4DA8FF] mb-0.5" />
                    <p className="text-sm font-extrabold text-white leading-none">{value}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide leading-tight"
                      style={{ color: "rgba(255,255,255,0.38)" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* ══════════════════════════════════════════════
          BOTTOM BANNER — dark strip
      ══════════════════════════════════════════════ */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="relative z-10 mx-6 mb-6 mt-4 rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #071729 0%, #0C2444 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 px-8 py-6">
          <div>
            <p className="text-white font-bold text-sm">
              Ready to streamline your MAP certification operations?
            </p>
            <p className="text-[#7AAAD4] text-xs font-medium mt-0.5">
              Built for Hexaware L&D, coordinators, approvers and candidates.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <motion.button
              onClick={() => navigate("/login")}
              whileHover={{ scale: 1.03, boxShadow: "0 4px 16px rgba(0,168,150,0.45)" }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all"
              style={{ background: "linear-gradient(135deg,#00A896,#00C6B3)", boxShadow: "0 2px 10px rgba(0,168,150,0.28)" }}
            >
              <LogIn size={14} /> Sign In to CertiQuest
            </motion.button>
            <p className="text-[10px] text-[#3D5A7A] font-semibold uppercase tracking-widest hidden md:block">
              Hexaware Technologies — Internal L&D Platform
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
