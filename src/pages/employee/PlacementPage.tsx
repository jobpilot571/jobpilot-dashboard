import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { PlacementWorkspace } from "@/pages/admin/PlacementPage";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";

export default function EmployeePlacementPage() {
  const { user } = useAuth();
  const { data: employee, isLoading } = useCurrentEmployee();

  if (!isLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <PlacementWorkspace role="employee" />
    </AppShell>
  );
}
