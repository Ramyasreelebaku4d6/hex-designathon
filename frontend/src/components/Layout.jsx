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
  Menu,
  X,
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
    { path: "/eligibility", label: "Eligibility", icon: CheckCircle },
    { path: "/results", label: "Results", icon: Award },
    { path: "/audit", label: "Audit Log", icon: FileText },
  ],
  approver: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/eligibility", label: "Eligibility", icon: CheckCircle },
  ],
  candidate: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/registrations", label: "My Registrations", icon: Users },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const items = navItems[user?.role] || [];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-primary">Maverick</h1>
              <p className="text-xs text-gray-500">Certification Hub</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-lg hover:bg-gray-100"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-3 space-y-1">
          {items.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === path
                  ? "bg-blue-50 text-primary"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-gray-200">
          {sidebarOpen && (
            <div className="mb-2 px-3">
              <p className="text-sm font-medium text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full"
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}