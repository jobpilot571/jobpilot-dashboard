import { useEffect, useMemo } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { AddApplicationForm } from "@/components/applications/AddApplicationForm";
import { AppStatusBadge } from "@/components/applications/AppStatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import {
  useDeleteJobApplication,
  useJobApplications,
  useUpdateJobApplication,
  APP_STATUSES,
} from "@/hooks/useJobApplications";
import { getTodayCST, formatTimeCST } from "@/lib/timezone";

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
  const { data: students = [], isLoading: stuLoading } = useMyStudents(employee?.id);

  const studentId = params.get("student") ?? "";
  const selected =
    studentId && students.some((s) => s.id === studentId) ? studentId : students[0]?.id ?? "";

  const { data: apps = [], isLoading: appsLoading } = useJobApplications(selected || undefined);
  const update = useUpdateJobApplication(selected || undefined);
  const remove = useDeleteJobApplication(selected || undefined);
  const today = getTodayCST();

  const todayApps = useMemo(
    () => apps.filter((a) => a.applied_date === today),
    [apps, today],
  );

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <CloseSidebarForApps />
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log job applications for an assigned student.
          </p>
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
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg">Add application</CardTitle>
              </CardHeader>
              <CardContent>
                <AddApplicationForm studentId={selected} employeeId={employee.id} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg">Today ({today})</CardTitle>
                <CardDescription>{todayApps.length} saved today for this student</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {appsLoading ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-y border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Link</th>
                          <th className="px-4 py-2 font-medium">Role</th>
                          <th className="px-4 py-2 font-medium">Company</th>
                          <th className="px-4 py-2 font-medium">Time</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {todayApps.map((a) => (
                          <tr key={a.id} className="border-b border-border/70 last:border-0">
                            <td className="px-4 py-2.5">
                              {a.applied_link ? (
                                <a
                                  href={a.applied_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                  Open <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-2.5">{a.job_role || "—"}</td>
                            <td className="px-4 py-2.5">{a.company_name || "—"}</td>
                            <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                              {formatTimeCST(a.applied_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.status === "applied" ? (
                                <AppStatusBadge status={a.status} />
                              ) : (
                                <Select
                                  className="h-8 w-[130px] text-xs"
                                  value={a.status}
                                  onChange={(e) =>
                                    update.mutate({ id: a.id, updates: { status: e.target.value } })
                                  }
                                >
                                  {APP_STATUSES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                      {s.label}
                                    </option>
                                  ))}
                                </Select>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {a.status !== "applied" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Delete"
                                  onClick={() => {
                                    if (confirm("Delete this application?")) remove.mutate(a.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {todayApps.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              No applications logged today for this student.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
