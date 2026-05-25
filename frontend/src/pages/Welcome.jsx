import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Lock,
  LogIn,
} from "lucide-react";

const highlights = [
  {
    title: "Create drives in minutes",
    description: "Set exam tracks, budget, timeline and approvals from one secure place.",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    title: "Auto eligibility decisions",
    description: "Use rules and AI to approve employees quickly and reduce manual work.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: "Safe voucher delivery",
    description: "Issue one encrypted voucher per candidate and stop duplicate sharing.",
    icon: <TrendingUp className="h-5 w-5" />,
  },
];

const slides = [
  {
    headline: "Create a MAP certification drive with one click",
    detail: "Run AZ-900, DP-100 and other tracks with budget and timelines built in.",
    accent: "Drive setup made easy",
  },
  {
    headline: "Employees register and receive instant updates",
    detail: "Auto emails and status reports keep everyone informed fast.",
    accent: "Faster candidate experience",
  },
  {
    headline: "Leaders see results, cost, and audit logs in one view",
    detail: "Track certified employees, spend, and compliance in real time.",
    accent: "Clear business visibility",
  },
];

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_22%),linear-gradient(180deg,_rgba(15,23,42,0.95),_rgba(15,23,42,0.9))] pointer-events-none"></div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-700/50 bg-slate-900/70 px-4 py-3 shadow-xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Hex Designathon</p>
              <p className="text-sm font-semibold text-white">Certification Drive</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 ring-1 ring-white/10 transition-all duration-200 hover:bg-white/15"
          >
            <LogIn className="h-4 w-4" />
            Login
          </button>
        </header>

        <main className="mt-14 flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <section className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 shadow-lg shadow-cyan-500/10">
              <Lock className="h-4 w-4 text-cyan-300" />
              Maverick Certification Hub for Hexaware MAP drives
            </div>

            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                Stop manual email, Excel, and voucher chaos with one central hub.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-300">
                Manage certification drives, approvals, and secure voucher delivery in one place. Designed for L&D, coordinators, approvers and employees to move from registration to certified faster.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-400"
              >
                <LogIn className="h-5 w-5" />
                Start with Login
              </button>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/85 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                <ArrowRight className="h-5 w-5" />
                Explore Features
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.title} className="group rounded-3xl border border-slate-700/70 bg-slate-900/80 p-5 transition duration-300 hover:border-cyan-400/40 hover:bg-slate-900">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/70 text-cyan-300 shadow-inner shadow-cyan-500/10">
                    {item.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative flex-1">
            <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute -left-16 bottom-8 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between rounded-3xl bg-slate-950/90 p-4 shadow-inner shadow-slate-950/50">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">DrivePulse</p>
                  <p className="text-sm font-semibold text-white">Certification Intelligence</p>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-4">
                {slides.map((slide, index) => (
                  <div
                    key={slide.headline}
                    className={`slide-card rounded-3xl border border-slate-700/80 bg-slate-950/85 p-6 text-slate-200 shadow-slate-950/20 ${index === 0 ? "bg-gradient-to-br from-cyan-500/20 to-slate-900/80" : "bg-slate-950/85"}`}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{slide.accent}</p>
                    <h2 className="mt-3 text-xl font-semibold text-white">{slide.headline}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{slide.detail}</p>
                    <div className="mt-5 inline-flex items-center gap-2 text-cyan-300">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/15">{index + 1}</span>
                      <span className="text-sm font-medium">Modern automation snapshot</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-3xl border border-slate-700/60 bg-slate-950/75 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Live deployment status</p>
                  <p className="text-xs text-slate-500">99.98% uptime guarantee for mission-critical drives.</p>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
