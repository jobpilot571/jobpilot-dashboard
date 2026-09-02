import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";
import { employeeSeesAllStudents } from "@/lib/employees";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import { useStudentAppStats } from "@/hooks/useStudentAppStats";
import { getStudentBucket, studentStartDate } from "@/lib/students";
import { formatRosterDate } from "@/lib/timezone";

export default function EmployeeStudentsPage() {
  const { user } = useAuth();
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const accessAll = employeeSeesAllStudents(employee);
  const { data: students = [], isLoading } = useMyStudents(employee?.id, {
    includeInactive: !accessAll,
    accessAllStudents: accessAll,
  });
  const { data: appStats = {} } = useStudentAppStats(students.map((s) => s.id));
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      // Team leads / all-students access: operational list is active (assigned) only.
      if (accessAll && getStudentBucket(s) !== "assigned") return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.program || "").toLowerCase().includes(q)
      );
    });
  }, [students, search, accessAll]);

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {accessAll ? "All students" : "My students"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accessAll ? "Active assigned students across the team." : "Students assigned to you."}
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, program…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[22%] px-2 py-2 font-medium">Student</th>
                <th className="w-[8rem] px-2 py-2 font-medium">Start Date</th>
                <th className="w-[14%] px-2 py-2 font-medium">Program</th>
                <th className="w-[4.5rem] px-2 py-2 font-medium">Apps</th>
                <th className="w-[4.5rem] px-2 py-2 font-medium">Today</th>
                <th className="w-[5.5rem] px-2 py-2 font-medium">Int.</th>
                <th className="px-2 py-2 font-medium">Documents</th>
                <th className="w-20 px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoading || empLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((s) => {
                    const bucket = getStudentBucket(s);
                    const stats = appStats[s.id];
                    const statusTone =
                      bucket === "inactive" ? "inactive" : bucket === "unassigned" ? "pending" : "active";
                    const docPct =
                      s.documents_total > 0
                        ? Math.round((s.documents_submitted / s.documents_total) * 100)
                        : 0;
                    return (
                      <tr key={s.id} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            to={`/app/students/${s.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <StatusDot tone={statusTone} pulse={statusTone === "active"} />
                              <span>{s.name}</span>
                            </span>
                          </Link>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatRosterDate(studentStartDate(s))}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.program || "—"}</td>
                        <td className="px-4 py-3 tabular-nums font-medium">{stats?.appCount ?? 0}</td>
                        <td className="px-4 py-3 tabular-nums">{stats?.todayCount ?? 0}</td>
                        <td className="px-4 py-3 tabular-nums">{stats?.interviewCount ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <ProgressBar value={docPct} />
                            <span className="text-[11px] text-muted-foreground">
                              {s.documents_submitted}/{s.documents_total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/app/students/${s.id}?tab=apps`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Log apps
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {accessAll
                      ? "No active students match your search."
                      : "No assigned students match your search."}
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
