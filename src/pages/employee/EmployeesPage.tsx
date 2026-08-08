import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import AdminEmployeesPage from "@/pages/admin/EmployeesPage";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { employeeIsTeamLead } from "@/lib/employees";

/** Team Lead–only employees roster (reuses admin employees UI without elevated-flag grants). */
export default function EmployeeTeamEmployeesPage() {
  const { user } = useAuth();
  const { data: employee, isLoading } = useCurrentEmployee();

  if (isLoading) {
    return (
      <AppShell role="employee">
        <div className="mx-auto max-w-7xl space-y-4 p-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  if (!employeeIsTeamLead(employee)) {
    return <Navigate to="/app" replace />;
  }

  return <AdminEmployeesPage portal="employee" />;
}
