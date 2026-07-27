import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { InactiveAccountScreen } from "@/components/auth/InactiveAccountScreen";
import { ROLE_HOME, type AppRole } from "@/lib/constants";

export function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: ReactNode;
  allowedRole: AppRole;
}) {
  const { user, role, accountStatus, loading, configError } = useAuth();
  const location = useLocation();

  if (configError) {
    return <LoadingScreen message={configError} />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (!role) {
    return <LoadingScreen message="Resolving your role…" />;
  }

  if (role !== allowedRole) {
    return <Navigate to={ROLE_HOME[role]} replace />;
  }

  if (role !== "admin" && accountStatus === "inactive") {
    return <InactiveAccountScreen role={role} />;
  }

  return <>{children}</>;
}
