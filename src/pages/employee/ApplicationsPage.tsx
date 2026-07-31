import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { StudentJobApplicationsTab } from "@/components/students/profile/JobApplicationsTab";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";

function CloseSidebarForApps() {
  const { setForceSidebarClosed } = useSidebarLayout();
  useEffect(() => {
    setForceSidebarClosed(true);
    return () => setForceSidebarClosed(false);
  }, [setForceSidebarClosed]);
  return null;
}

export default function EmployeeApplicationsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { data: students = [], isLoading: stuLoading } = useMyStudents(employee?.id, {
    accessAllStudents: !!employee?.can_access_all_students,
  });

  const studentId = params.get("student") ?? "";
  const selected =
    studentId && students.some((s) => s.id === studentId) ? studentId : students[0]?.id ?? "";

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <CloseSidebarForApps />
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Applications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Log job applications for an assigned student. Switch to All previous to see older links.
            </p>
          </div>
          {selected ? (
            <Link
              to={`/app/students/${selected}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open full student profile
            </Link>
          ) : null}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-lg">Student</CardTitle>
            <CardDescription>Only students assigned to you are listed.</CardDescription>
          </CardHeader>
          <CardContent>
            {stuLoading || empLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students assigned yet.</p>
            ) : (
              <Select
                className="max-w-md"
                value={selected}
                onChange={(e) => {
                  const id = e.target.value;
                  setParams(id ? { student: id } : {});
                }}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.program || "—"}
                  </option>
                ))}
              </Select>
            )}
          </CardContent>
        </Card>

        {selected && employee ? (
          <StudentJobApplicationsTab studentId={selected} employeeId={employee.id} />
        ) : null}
      </div>
    </AppShell>
  );
}
