import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Info,
  RefreshCw,
  Sparkles,
  Target,
  UserCheck,
  UserMinus,
  Users,
  CalendarDays,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { formatDateCST, formatTimeCST, getTodayCST, getWeekRangeCST } from "@/lib/timezone";

function AlertToneIcon({ tone }: { tone: "warning" | "danger" | "info" }) {
  if (tone === "danger") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (tone === "warning") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-sky-600" />;
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminDashboardStats();
  const today = getTodayCST();
  const week = getWeekRangeCST();

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operations</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Live snapshot · CST {today} · week {week.start} → {week.end}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {isError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load dashboard</CardTitle>
              <CardDescription className="break-words text-destructive/80">
                {getErrorMessage(error)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Hero KPI band */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#123a8a] via-[#1d4ed8] to-[#0ea5e9] p-5 shadow-xl sm:p-6">
          <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-indigo-400/25 blur-3xl" />
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Today at a glance</h2>
              <p className="text-sm text-white/70">Key metrics across your team</p>
            </div>
            <Sparkles className="h-5 w-5 text-white/70" />
          </div>
          <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[108px] rounded-2xl bg-white/20" />
              ))
            ) : (
              <>
                <StatCard
                  variant="hero"
                  label="Employees"
                  value={data.employees.active}
                  hint="Active only"
                  icon={Users}
                  to="/admin/employees"
                />
                <StatCard
                  variant="hero"
                  label="Students"
                  value={data.students.active}
                  hint="Active assigned only"
                  icon={GraduationCap}
                  to="/admin/students?status=active"
                />
                <StatCard
                  variant="hero"
                  label="Apps today"
                  value={data.applications.today}
                  hint="America/Chicago calendar day"
                  icon={Briefcase}
                  to="/admin/reports"
                />
                <StatCard
                  variant="hero"
                  label="Unassigned students"
                  value={data.students.unassigned}
                  hint="Active & not assigned to a counselor"
                  icon={UserMinus}
                  to="/admin/students?status=pending"
                />
              </>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading || !data ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Assigned students"
                value={data.students.assigned}
                hint="Active students with a counselor"
                icon={UserCheck}
                tone="success"
                to="/admin/students?status=active"
              />
              <StatCard
                label="Apps this week"
                value={data.applications.week}
                hint="Mon–Sun CST"
                icon={CalendarDays}
                to="/admin/reports"
              />
              <StatCard
                label="Interviews"
                value={data.interviews}
                hint="Screening + technical + panel"
                icon={Target}
                tone="info"
                to="/admin/placement"
              />
              <StatCard
                label="Placements / offers"
                value={data.placements}
                hint="Offer-stage pipeline events"
                icon={CheckCircle2}
                tone="success"
                to="/admin/placement"
              />
            </>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading || !data ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={`p-${i}`} className="h-[96px] rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Assessments"
                value={data.pipeline.assessment}
                hint="Forwarded · assessment stage"
                icon={Briefcase}
                to="/admin/placement"
              />
              <StatCard
                label="Screening"
                value={data.pipeline.screening}
                hint="Recruiter screening rounds"
                icon={Users}
                tone="info"
                to="/admin/placement"
              />
              <StatCard
                label="Technical"
                value={data.pipeline.technical}
                hint="Technical interview rounds"
                icon={Target}
                tone="warning"
                to="/admin/placement"
              />
              <StatCard
                label="Panel"
                value={data.pipeline.panel}
                hint="Final / panel rounds"
                icon={CheckCircle2}
                tone="success"
                to="/admin/placement"
              />
            </>
          )}
        </section>

        {/* Employee performance — primary focus */}
        <section>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-display text-base">Employee performance — today</CardTitle>
                  <CardDescription>Apps vs students × per-student daily target (default 40)</CardDescription>
                </div>
                <Link
                  to="/admin/employees"
                  className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading || !data ? (
                <Skeleton className="h-48 w-full" />
              ) : data.employeePerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active employees found.</p>
              ) : (
                <table className="w-full table-fixed text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">Employee</th>
                      <th className="pb-2 font-medium">Students</th>
                      <th className="pb-2 font-medium">Apps</th>
                      <th className="pb-2 font-medium">Target</th>
                      <th className="pb-2 font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employeePerformance.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="border-b border-border/60 transition hover:bg-muted/40 last:border-0"
                      >
                        <td className="py-3 font-medium text-foreground">
                          <Link to="/admin/employees" className="hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-3 tabular-nums text-muted-foreground">{row.assignedStudents}</td>
                        <td className="py-3">
                          <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                            {row.appsToday}
                          </span>
                        </td>
                        <td className="py-3 tabular-nums text-muted-foreground">{row.dailyTarget}</td>
                        <td className="py-3">
                          <ProgressBar value={row.progressPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Alerts + status + activity — secondary */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Important alerts</CardTitle>
              <CardDescription>Operational items that need attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading || !data ? (
                <Skeleton className="h-24 w-full" />
              ) : data.alerts.length === 0 ? (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-4 text-sm text-emerald-800">
                  All clear — no alerts right now.
                </p>
              ) : (
                data.alerts.map((alert) => {
                  const href =
                    alert.id === "unassigned"
                      ? "/admin/students?status=pending"
                      : alert.id === "trials"
                        ? "/admin/free-trials"
                        : alert.id === "low-progress"
                          ? "/admin/employees"
                          : undefined;
                  const body = (
                    <>
                      <AlertToneIcon tone={alert.tone} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
                      </div>
                    </>
                  );
                  const className = cn(
                    "flex gap-3 rounded-xl border px-3 py-3 transition hover:shadow-sm",
                    alert.tone === "danger" && "border-destructive/20 bg-destructive/5",
                    alert.tone === "warning" && "border-amber-500/20 bg-amber-500/5",
                    alert.tone === "info" && "border-sky-500/20 bg-sky-500/5",
                    href && "cursor-pointer hover:border-primary/30",
                  );
                  return href ? (
                    <Link key={alert.id} to={href} className={className}>
                      {body}
                    </Link>
                  ) : (
                    <div key={alert.id} className={className}>
                      {body}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Student status</CardTitle>
              <CardDescription>Derived from status + assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !data ? (
                <Skeleton className="h-28 w-full" />
              ) : (
                <>
                  <StatusRow
                    label="Assigned (active)"
                    value={data.studentStatusSummary.assigned}
                    to="/admin/students?status=active"
                  />
                  <StatusRow
                    label="Unassigned / pending"
                    value={data.studentStatusSummary.unassigned}
                    to="/admin/students?status=pending"
                  />
                  <StatusRow
                    label="Inactive"
                    value={data.studentStatusSummary.inactive}
                    to="/admin/students?status=inactive"
                  />
                  <div className="pt-2">
                    <Link
                      to="/admin/students"
                      className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                    >
                      Manage students
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Recent activity</CardTitle>
              <CardDescription>Latest job applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !data ? (
                <Skeleton className="h-48 w-full" />
              ) : data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                data.recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    to={`/admin/students/${item.studentId}?tab=apps`}
                    className="block rounded-xl border border-border/80 bg-gradient-to-r from-card to-muted/30 px-3 py-2.5 transition hover:border-primary/25 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.studentName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDateCST(item.appliedAt)} {formatTimeCST(item.appliedAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.role} · {item.company}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold capitalize text-primary">{item.status}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function StatusRow({ label, value, to }: { label: string; value: number; to?: string }) {
  const inner = (
    <>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-display text-lg font-semibold tabular-nums text-foreground">{value}</span>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center justify-between border-b border-border/70 py-2 last:border-0 hover:text-primary"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between border-b border-border/70 py-2 last:border-0">{inner}</div>
  );
}
