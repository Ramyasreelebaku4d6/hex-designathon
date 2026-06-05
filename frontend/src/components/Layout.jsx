import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  CheckCircle,
  Award,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useState } from "react";

const navItems = {
  admin: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/drives", label: "Drives", icon: FolderOpen },
    { path: "/registrations", label: "Registrations", icon: Users },
    { path: "/eligibility", label: "Eligibility", icon: CheckCircle },
    { path: "/results", label: "Results", icon: Award },
    { path: "/vouchers", label: "Vouchers", icon: Award },
    { path: "/audit", label: "Audit Log", icon: FileText },
  ],
  coordinator: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/drives", label: "Drives", icon: FolderOpen },
    { path: "/registrations", label: "Registrations", icon: Users },
    { path: "/audit", label: "Audit Log", icon: FileText },
  ],
  approver: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/eligibility", label: "Eligibility", icon: CheckCircle },
  ],
  candidate: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/registrations", label: "Open Drives", icon: FolderOpen },
  ],
};

const roleColors = {
  admin: "bg-[#EBF3FF] text-[#0062CC]",
  coordinator: "bg-emerald-50 text-emerald-700",
  approver: "bg-amber-50 text-amber-700",
  candidate: "bg-[#E0F5F3] text-[#008A7C]",
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const items = navItems[user?.role] || [];

  return (
    <div className="flex h-screen bg-lightBg overflow-hidden">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-[72px]"
        } flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out shadow-sidebar relative z-20`}
        style={{ background: "linear-gradient(170deg, #071729 0%, #0C2444 55%, #0F3060 100%)" }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* ── Logo ──────────────────────────────── */}
        <div className="relative flex items-center justify-between px-4 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* CertiQuest icon */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-glow-md"
              style={{ background: "linear-gradient(135deg, #0062CC, #00A896)" }}
            >
              <Shield size={18} className="text-white" strokeWidth={2.5} />
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in">
                <p className="text-[15px] font-extrabold text-white tracking-tight leading-none">
                  CertiQuest
                </p>
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#6B8EB5] mt-0.5 font-semibold">
                  MAP Intelligence Platform
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#6B8EB5] hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* ── Navigation ────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {!sidebarOpen && (
            <p className="text-[8px] text-[#3D5A7A] font-bold uppercase tracking-widest text-center mb-3 px-2">
              Menu
            </p>
          )}
          {sidebarOpen && (
            <p className="text-[9px] text-[#3D5A7A] font-bold uppercase tracking-widest px-3 mb-2">
              Navigation
            </p>
          )}

          {items.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                title={!sidebarOpen ? label : undefined}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white shadow-[0_2px_12px_rgba(0,98,204,0.35)]"
                    : "text-[#8AAECF] hover:text-white hover:bg-white/[0.07]"
                }`}
                style={isActive ? { background: "linear-gradient(135deg, #0062CC, #0074E8)" } : {}}
              >
                {/* Active left accent */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-r-full" />
                )}
                <Icon
                  size={17}
                  className={isActive ? "text-white" : "text-[#6B8EB5] group-hover:text-white transition-colors"}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {sidebarOpen && (
                  <span className="tracking-wide text-[13px]">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── User Profile ──────────────────────── */}
        <div className="px-3 pb-4 pt-3 border-t border-white/[0.07]">
          {sidebarOpen && user && (
            <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-white/[0.05] border border-white/[0.07]">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-inner"
                style={{ background: "linear-gradient(135deg, #0062CC, #00A896)" }}
              >
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white truncate leading-snug">{user.name}</p>
                <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md mt-0.5 ${roleColors[user.role] || "bg-white/10 text-white/60"}`}>
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            title={!sidebarOpen ? "Logout" : undefined}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8AAECF] hover:bg-rose-500/10 hover:text-rose-400 w-full transition-all duration-200 font-medium"
          >
            <LogOut size={16} strokeWidth={2} />
            {sidebarOpen && <span className="text-[13px]">Sign Out</span>}
          </button>

          {sidebarOpen && (
            <p className="text-[9px] text-[#3D5A7A] text-center mt-3 font-semibold tracking-wider">
              Hexaware Technologies
            </p>
          )}
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-[#DDE5F4] px-8 py-3.5 flex items-center justify-between flex-shrink-0 shadow-[0_1px_3px_rgba(7,23,41,0.04)]">
          <div className="flex items-center gap-2 text-[#8FA3BF]">
            <Shield size={14} className="text-primary" />
            <span className="text-xs font-semibold text-[#4A5E7D]">CertiQuest</span>
            <span className="text-[#DDE5F4]">/</span>
            <span className="text-xs font-semibold text-[#0B1837] capitalize">
              {location.pathname.replace("/", "") || "dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary animate-pulse-dot" />
            <span className="text-[11px] font-semibold text-[#8FA3BF]">Live</span>
          </div>
        </div>

        <div className="p-8 max-w-7xl w-full mx-auto flex-1 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
