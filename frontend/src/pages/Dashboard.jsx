import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/dashboards/AdminDashboard";
import CoordinatorDashboard from "../components/dashboards/CoordinatorDashboard";
import ApproverDashboard from "../components/dashboards/ApproverDashboard";
import CandidateDashboard from "../components/dashboards/CandidateDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "coordinator") return <CoordinatorDashboard />;
  if (user?.role === "approver") return <ApproverDashboard />;
  if (user?.role === "candidate") return <CandidateDashboard />;

  return (
    <div className="card text-center text-gray-500">
      No dashboard available for your role.
    </div>
  );
}