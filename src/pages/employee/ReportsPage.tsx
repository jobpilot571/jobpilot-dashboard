import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { StatCard } from "@/components/dashboard/StatCard";
import { SimpleBarList, TrendBars } from "@/components/reports/Charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CalendarDays, Trophy, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import {
  downloadCsv,
  useReportFiltersDefaults,
  useReportsData,
  type ReportFilters,
} from "@/hooks/useReportsData";

export default function EmployeeReportsPage() {
  const { user } = useAuth();
  const defaults = useReportFiltersDefaults();
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { data: myStudents = [] } = useMyStudents(employee?.id, {
    includeInactive: true,
    accessAllStudents: !!employee?.can_access_all_students,
  });

  const [filters, setFilters] = useState<ReportFilters>({
    ...defaults,
    employeeId: "all",
  });

  useEffect(() => {
    if (employee?.id) {
      setFilters((prev) => ({ ...prev, employeeId: employee.id }));
    }
  }, [employee?.id]);

  const employees = useMemo(() => (employee ? [employee] : []), [employee]);
  const { data, isLoading, isError, error, refetch } = useReportsData(filters, employees, myStudents);

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Scoped to your assigned students only.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              downloadCsv(
                `my-report-${data.filters.dateFrom}_${data.filters.dateTo}.csv`,
                ["date", "applications"],
                data.trendDaily.map((p) => [p.date, p.count]),
              );
            }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export trend
          </Button>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Student</span>
            <Select
              value={filters.studentId}
              onChange={(e) => setFilters((f) => ({ ...f, studentId: e.target.value }))}
            >
              <option value="all">All my students</option>
              {myStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Failed to load report</p>
            <p className="mt-1 text-muted-foreground">{(error as Error)?.message}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {(isLoading || empLoading) && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Apps in range" value={data.kpis.appsInRange} icon={Briefcase} />
              <StatCard label="Apps today" value={data.kpis.appsToday} icon={CalendarDays} />
              <StatCard label="Interviews" value={data.kpis.interviews} icon={Users} tone="info" />
              <StatCard
                label="Placements"
                value={data.kpis.placements}
                icon={Trophy}
                tone="success"
              />
            </div>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-display text-lg font-semibold">Applications by day</h2>
              <TrendBars points={data.trendDaily} />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-display text-lg font-semibold">By role</h2>
                <SimpleBarList items={data.byRole} />
              </section>
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 font-display text-lg font-semibold">By company</h2>
                <SimpleBarList items={data.byCompany} />
              </section>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Program</th>
                    <th className="px-4 py-3 font-medium">Apps</th>
                    <th className="px-4 py-3 font-medium">Interviews</th>
                  </tr>
                </thead>
                <tbody>
                  {data.studentPerf.map((r) => (
                    <tr key={r.studentId} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.program}</td>
                      <td className="px-4 py-3 tabular-nums">{r.appsInRange}</td>
                      <td className="px-4 py-3 tabular-nums">{r.interviews}</td>
                    </tr>
                  ))}
                  {data.studentPerf.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No student activity in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
