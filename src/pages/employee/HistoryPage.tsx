import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { AppStatusBadge } from "@/components/applications/AppStatusBadge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import { useMyApplicationsHistory } from "@/hooks/useJobApplications";
import { employeeSeesAllStudents } from "@/lib/employees";
import { getTodayCST } from "@/lib/timezone";
import { downloadCsv } from "@/hooks/useReportsData";

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default function EmployeeHistoryPage() {
  const { user } = useAuth();
  const today = getTodayCST();
  const [dateFrom, setDateFrom] = useState(addDays(today, -13));
  const [dateTo, setDateTo] = useState(today);
  const [studentId, setStudentId] = useState("all");

  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { data: students = [] } = useMyStudents(employee?.id, {
    includeInactive: true,
    accessAllStudents: employeeSeesAllStudents(employee),
  });
  const studentIds = students.map((s) => s.id);
  const nameById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s.name])),
    [students],
  );

  const { data: apps = [], isLoading, isError, error, refetch } = useMyApplicationsHistory(studentIds, {
    dateFrom,
    dateTo,
    studentId,
  });

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">History</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Application history for your assigned students.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={apps.length === 0}
            onClick={() =>
              downloadCsv(
                `my-apps-${dateFrom}_${dateTo}.csv`,
                ["date", "student", "company", "role", "status", "link"],
                apps.map((a) => [
                  a.applied_date,
                  nameById[a.student_id] ?? a.student_id,
                  a.company_name,
                  a.job_role,
                  a.status,
                  a.applied_link,
                ]),
              )
            }
          >
            Export CSV
          </Button>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Student</span>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="all">All my students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Failed to load history</p>
            <p className="mt-1 text-muted-foreground">{(error as Error)?.message}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Company / Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || empLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                : apps.map((a) => (
                    <tr key={a.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{a.applied_date}</td>
                      <td className="px-4 py-3 font-medium">{nameById[a.student_id] ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div>{a.company_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{a.job_role || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <AppStatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3">
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
                    </tr>
                  ))}
              {!isLoading && apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No applications in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
