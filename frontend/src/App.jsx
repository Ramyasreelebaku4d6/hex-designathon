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
import AuthCallback from "./pages/AuthCallback"; 
import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "./context/AuthContext";
import { verifyMicrosoftToken } from "./api/microsoftAuth";
import { useNavigate } from "react-router-dom";

function MsalRedirectHandler() {
  const { instance } = useMsal();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    instance.handleRedirectPromise()
      .then(async (result) => {
        if (result && result.accessToken) {
          console.log("[MS-AUTH] Redirect handled:", result);
          try {
            const data = await verifyMicrosoftToken(result.accessToken);
            loginWithToken(data);
            navigate("/dashboard");
          } catch (err) {
            console.error("[MS-AUTH] Token verify failed:", err);
            navigate("/login");
          }
        }
        if (
      !window.location.href.includes("code=") &&
      !window.location.href.includes("error=")
    ) {
      return;
    }
      })
      .catch(err => {
        console.error("[MS-AUTH] Redirect error:", err);
      });
  }, []);

  return null;
}

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
    <>
      <MsalRedirectHandler />
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
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
    </>
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