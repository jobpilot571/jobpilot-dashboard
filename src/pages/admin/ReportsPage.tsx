import { useMemo, useState } from "react";
import {
  BarChart3,
  Briefcase,
  Download,
  Target,
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/dialog";
import { SimpleBarList, TrendBars } from "@/components/reports/Charts";
import { useEmployees } from "@/hooks/useEmployees";
import { useStudents } from "@/hooks/useStudents";
import {
  downloadCsv,
  useReportFiltersDefaults,
  useReportsData,
  type ReportFilters,
} from "@/hooks/useReportsData";
import { formatHoursMinutes, statusLabel, REQUIRED_ACTIVE_HOURS } from "@/lib/consistency";
import { cn } from "@/lib/utils";

type Section = "overview" | "employees" | "students" | "consistency" | "breakdowns";

function consistencyBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "below_required") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-border bg-muted text-muted-foreground";
}

export default function AdminReportsPage() {
  const defaults = useReportFiltersDefaults();
  const [filters, setFilters] = useState<ReportFilters>(defaults);
  const [section, setSection] = useState<Section>("overview");

  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: students = [], isLoading: stuLoading } = useStudents();
  const { data, isLoading, isError, error, refetch } = useReportsData(filters, employees, students);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "inactive").sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );
  const studentOptions = useMemo(() => {
    let list = students;
    if (filters.employeeId !== "all") list = list.filter((s) => s.assigned_to === filters.employeeId);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filters.employeeId]);

  const loading = empLoading || stuLoading || isLoading;

  function setFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "employeeId") next.studentId = "all";
      return next;
    });
  }

  function exportOverview() {
    if (!data) return;
    downloadCsv(
      `jobpilot-overview-${data.filters.dateFrom}_${data.filters.dateTo}.csv`,
      ["metric", "value"],
      [
        ["apps_in_range", data.kpis.appsInRange],
        ["apps_today", data.kpis.appsToday],
        ["apps_this_week", data.kpis.appsThisWeek],
        ["interviews", data.kpis.interviews],
        ["placements", data.kpis.placements],
        ["students_active", data.kpis.studentsActive],
        ["students_inactive", data.kpis.studentsInactive],
        ["students_assigned", data.kpis.studentsAssigned],
        ["students_unassigned", data.kpis.studentsUnassigned],
      ],
    );
  }

  function exportEmployees() {
    if (!data) return;
    downloadCsv(
      `jobpilot-employee-perf-${data.filters.dateFrom}_${data.filters.dateTo}.csv`,
      [
        "employee",
        "assigned_students",
        "apps_in_range",
        "apps_today",
        "daily_target",
        "target_pct",
        "consistency_status",
        "active_minutes",
        "break_minutes",
      ],
      data.employeePerf.map((r) => [
        r.name,
        r.assignedStudents,
        r.appsInRange,
        r.appsToday,
        r.dailyTarget,
        r.progressPct,
        r.consistency.status,
        r.consistency.activeMinutes,
        r.consistency.breakUsedMinutes,
      ]),
    );
  }

  function exportStudents() {
    if (!data) return;
    downloadCsv(
      `jobpilot-student-perf-${data.filters.dateFrom}_${data.filters.dateTo}.csv`,
      ["student", "program", "assigned_to", "bucket", "apps_in_range", "interviews"],
      data.studentPerf.map((r) => [r.name, r.program, r.assignedTo, r.bucket, r.appsInRange, r.interviews]),
    );
  }

  function exportTrend() {
    if (!data) return;
    downloadCsv(
      `jobpilot-apps-by-day-${data.filters.dateFrom}_${data.filters.dateTo}.csv`,
      ["date", "applications"],
      data.trendDaily.map((p) => [p.date, p.count]),
    );
  }

  const tabs: { id: Section; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "employees", label: "Employees" },
    { id: "students", label: "Students" },
    { id: "consistency", label: "Consistency" },
    { id: "breakdowns", label: "Breakdowns" },
  ];

  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Applications, targets, placements, and consistency — filtered by date and assignment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportOverview} disabled={!data}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export KPIs
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportTrend} disabled={!data}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export trend
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Employee</span>
            <Select value={filters.employeeId} onChange={(e) => setFilter("employeeId", e.target.value)}>
              <option value="all">All employees</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Student</span>
            <Select value={filters.studentId} onChange={(e) => setFilter("studentId", e.target.value)}>
              <option value="all">All students</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border pb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                section === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Failed to load reports</p>
            <p className="mt-1 text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : null}

        {data && section === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Apps in range" value={data.kpis.appsInRange} icon={Briefcase} />
              <StatCard label="Apps today" value={data.kpis.appsToday} icon={CalendarDays} hint={data.today} />
              <StatCard label="This week" value={data.kpis.appsThisWeek} icon={BarChart3} />
              <StatCard label="Interviews" value={data.kpis.interviews} icon={Users} tone="info" />
              <StatCard label="Placements (offer)" value={data.kpis.placements} icon={Trophy} tone="success" />
              <StatCard label="Active students" value={data.kpis.studentsActive} icon={UserCheck} />
              <StatCard label="Assigned" value={data.kpis.studentsAssigned} icon={Users} />
              <StatCard
                label="Unassigned / Inactive"
                value={`${data.kpis.studentsUnassigned} / ${data.kpis.studentsInactive}`}
                icon={UserX}
                tone="warning"
              />
            </div>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-display text-lg font-semibold">Applications by day</h2>
              <TrendBars points={data.trendDaily} />
            </section>
          </div>
        ) : null}

        {data && section === "employees" ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={exportEmployees}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export employees
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Students</th>
                    <th className="px-4 py-3 font-medium">Apps (range)</th>
                    <th className="px-4 py-3 font-medium">Today / Target</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employeePerf.map((row) => (
                    <tr key={row.employeeId} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 tabular-nums">{row.assignedStudents}</td>
                      <td className="px-4 py-3 tabular-nums">{row.appsInRange}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {row.appsToday} / {row.dailyTarget}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.progressPct >= 100 ? "bg-emerald-500" : "bg-primary",
                              )}
                              style={{ width: `${Math.min(100, row.progressPct)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-muted-foreground">{row.progressPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.employeePerf.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No employees match filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {data && section === "students" ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={exportStudents}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export students
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Program</th>
                    <th className="px-4 py-3 font-medium">Assigned to</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Apps</th>
                    <th className="px-4 py-3 font-medium">Interviews</th>
                  </tr>
                </thead>
                <tbody>
                  {data.studentPerf.map((row) => (
                    <tr key={row.studentId} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.program}</td>
                      <td className="px-4 py-3">{row.assignedTo}</td>
                      <td className="px-4 py-3 capitalize">{row.bucket}</td>
                      <td className="px-4 py-3 tabular-nums">{row.appsInRange}</td>
                      <td className="px-4 py-3 tabular-nums">{row.interviews}</td>
                    </tr>
                  ))}
                  {data.studentPerf.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No students match filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Showing top 50 by applications in range.</p>
          </div>
        ) : null}

        {data && section === "consistency" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Today&apos;s consistency ({data.today}, America/Chicago): ~{REQUIRED_ACTIVE_HOURS}h active with up to
              1h break. Based on applications stamped with <code className="text-xs">created_by_employee_id</code>.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Apps</th>
                    <th className="px-4 py-3 font-medium">Active</th>
                    <th className="px-4 py-3 font-medium">Break</th>
                    <th className="px-4 py-3 font-medium">Window</th>
                    <th className="px-4 py-3 font-medium">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employeePerf.map((row) => {
                    const c = row.consistency;
                    return (
                      <tr key={row.employeeId} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3">
                          <Badge className={consistencyBadgeClass(c.status)}>{statusLabel(c.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{c.totalApplications}</td>
                        <td className="px-4 py-3 tabular-nums">{formatHoursMinutes(c.activeMinutes)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatHoursMinutes(c.breakUsedMinutes)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.startTimeLabel} – {c.lastApplicationLabel}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.inactiveNow ? (
                            <span className="text-amber-700">Inactive {c.minutesSinceLastApp}m</span>
                          ) : c.slowGaps > 0 || c.inactiveGaps > 0 ? (
                            <span>
                              {c.slowGaps} slow / {c.inactiveGaps} long gaps
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Consistency lives under Reports (not a separate nav item).
            </p>
          </div>
        ) : null}

        {data && section === "breakdowns" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">By role</h2>
              </div>
              <SimpleBarList items={data.byRole} />
            </section>
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">By company</h2>
              </div>
              <SimpleBarList items={data.byCompany} />
            </section>
            <p className="text-xs text-muted-foreground lg:col-span-2">{data.sourceNote}</p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
