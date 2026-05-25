import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Drives from "./pages/Drives";
import Registrations from "./pages/Registrations";
import Eligibility from "./pages/Eligibility";
import Results from "./pages/Results";
import Vouchers from "./pages/Vouchers";
import AuditLog from "./pages/AuditLog";
import Redeem from "./pages/Redeem";
import Welcome from "./pages/Welcome";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/redeem/:token" element={<Redeem />} />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/drives"
        element={
          <ProtectedRoute roles={["admin", "coordinator"]}>
            <Layout>
              <Drives />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/registrations"
        element={
          <ProtectedRoute>
            <Layout>
              <Registrations />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/eligibility"
        element={
          <ProtectedRoute roles={["admin", "coordinator", "approver"]}>
            <Layout>
              <Eligibility />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/results"
        element={
          <ProtectedRoute roles={["admin", "coordinator"]}>
            <Layout>
              <Results />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vouchers"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout>
              <Vouchers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute roles={["admin", "coordinator"]}>
            <Layout>
              <AuditLog />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Public welcome and login */}
      <Route path="/" element={<Welcome />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}