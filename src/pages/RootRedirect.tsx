import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { MissingRoleScreen } from "@/components/auth/MissingRoleScreen";
import { ROLE_HOME } from "@/lib/constants";

/** Root entry: send authenticated users to their role home; others to login. */
export default function RootRedirect() {
  const { user, role, loading, configError } = useAuth();

  if (configError) return <LoadingScreen message={configError} />;
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <MissingRoleScreen />;
  return <Navigate to={ROLE_HOME[role]} replace />;
}
