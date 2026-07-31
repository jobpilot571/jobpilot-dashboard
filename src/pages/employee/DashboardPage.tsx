import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  FileText,
  GraduationCap,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AppStatusBadge } from "@/components/applications/AppStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import { useEmployeeWorkspaceStats } from "@/hooks/useEmployeeWorkspaceStats";
import { formatHoursMinutes, statusLabel, INACTIVITY_ALERT_MIN } from "@/lib/consistency";
import { formatTimeCST } from "@/lib/timezone";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const { data: employee, isLoading: empLoading, isError: empError, error: empErr, refetch: refetchEmp } =
    useCurrentEmployee();
  const { data: students = [], isLoading: stuLoading } = useMyStudents(employee?.id);
  const { data: stats, isLoading: statsLoading, refetch, isFetching } = useEmployeeWorkspaceStats(
    employee,
    students,
  );

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  const firstName = (employee?.name ?? user?.email ?? "there").split(" ")[0].split("@")[0];
  const loading = empLoading || stuLoading || statsLoading;

  return (
    <AppShell role="employee">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Assigned students, today&apos;s applications, and progress vs your daily target.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {empError ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load profile</CardTitle>
              <CardDescription>{empErr instanceof Error ? empErr.message : "Unknown error"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void refetchEmp()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}

        {stats?.consistency.inactiveNow && stats.consistency.totalApplications > 0 ? (
          <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium text-foreground">Inactivity detected</p>
              <p className="mt-1 text-muted-foreground">
                No application in {stats.consistency.minutesSinceLastApp} minutes (threshold{" "}
                {INACTIVITY_ALERT_MIN} min). Active so far:{" "}
                {formatHoursMinutes(stats.consistency.activeMinutes)}.
              </p>
            </div>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading || !stats ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Assigned students"
                value={students.length}
                icon={GraduationCap}
                to="/app/students"
              />
              <StatCard
                label="Apps today"
                value={stats.appsToday}
                hint={stats.today}
                icon={Briefcase}
                tone="info"
                to="/app/applications"
              />
              <StatCard label="This week" value={stats.appsThisWeek} icon={CalendarDays} to="/app/history" />
              <StatCard
                label="Docs pending"
                value={stats.docsPending}
                icon={FileText}
                tone={stats.docsPending > 0 ? "warning" : "default"}
                to="/app/students"
              />
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Target className="h-4 w-4 text-primary" />
                Daily target
              </CardTitle>
              <CardDescription>
                {stats ? (
                  <>
                    {stats.appsToday} of {stats.dailyTarget} applications today
                  </>
                ) : (
                  "Loading…"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats ? <ProgressBar value={stats.progressPct} /> : <Skeleton className="h-4 w-full" />}
              <div className="mt-4">
                <Link
                  to="/app/applications"
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  Log applications
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Consistency today</CardTitle>
              <CardDescription>~7h active with up to 1h break (America/Chicago)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {stats ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">{statusLabel(stats.consistency.status)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active</span>
                    <span className="tabular-nums">{formatHoursMinutes(stats.consistency.activeMinutes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Window</span>
                    <span>
                      {stats.consistency.startTimeLabel} – {stats.consistency.lastApplicationLabel}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Link
                      to="/app/performance"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                    >
                      View performance
                    </Link>
                  </div>
                </>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Apps today by student</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Student</th>
                      <th className="px-4 py-2 text-right font-medium">Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.studentCounts ?? []).map((s) => (
                      <tr key={s.studentId} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-2.5">
                          <Link
                            className="font-medium text-foreground hover:underline"
                            to={`/app/students/${s.studentId}`}
                          >
                            {s.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.count}</td>
                      </tr>
                    ))}
                    {!loading && (stats?.studentCounts.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                          No students assigned yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Recent applications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Student</th>
                      <th className="px-4 py-2 font-medium">Role / Company</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recentApps ?? []).map((a) => (
                      <tr key={a.id} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-2.5">
                          <Link
                            className="font-medium text-foreground hover:underline"
                            to={`/app/students/${a.studentId}?tab=apps`}
                          >
                            {a.studentName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <div>{a.role || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.company || "—"} · {formatTimeCST(a.appliedAt)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <AppStatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                    {!loading && (stats?.recentApps.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                          No applications yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
