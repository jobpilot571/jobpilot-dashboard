import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { ROLE_HOME } from "@/lib/constants";

/** Root entry: send authenticated users to their role home; others to login. */
export default function RootRedirect() {
  const { user, role, loading, configError, signOut } = useAuth();

  if (configError) return <LoadingScreen message={configError} />;
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-md text-sm text-foreground">
          Your account is signed in, but no role was found in the database. Sign out and ask an admin to
          recreate your login, or contact support.
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }
  return <Navigate to={ROLE_HOME[role]} replace />;
}
