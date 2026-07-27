import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { TrendBars } from "@/components/reports/Charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, Target } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import { useEmployeeWorkspaceStats } from "@/hooks/useEmployeeWorkspaceStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  formatHoursMinutes,
  statusLabel,
  REQUIRED_ACTIVE_HOURS,
} from "@/lib/consistency";
import { getTodayCST } from "@/lib/timezone";

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function consistencyBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "below_required") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-border bg-muted text-muted-foreground";
}

export default function EmployeePerformancePage() {
  const { user } = useAuth();
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { data: students = [] } = useMyStudents(employee?.id);
  const { data: stats, isLoading } = useEmployeeWorkspaceStats(employee, students);
  const today = getTodayCST();
  const from = addDays(today, -13);

  const trend = useQuery({
    queryKey: ["my-perf-trend", employee?.id, from, today, students.map((s) => s.id).join(",")],
    enabled: !!employee?.id && students.length > 0,
    queryFn: async () => {
      const ids = students.map((s) => s.id);
      const { data, error } = await supabase
        .from("job_applications")
        .select("applied_date")
        .in("student_id", ids)
        .gte("applied_date", from)
        .lte("applied_date", today);
      if (error) throw error;
      const map: Record<string, number> = {};
      let cur = from;
      while (cur <= today) {
        map[cur] = 0;
        cur = addDays(cur, 1);
      }
      for (const a of data ?? []) map[a.applied_date] = (map[a.applied_date] ?? 0) + 1;
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
    },
  });

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  return (
    <AppShell role="employee">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily target progress and consistency for today.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {isLoading || !stats ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Apps today"
                value={stats.appsToday}
                hint={`Target ${stats.dailyTarget}`}
                icon={Briefcase}
              />
              <StatCard
                label="Target progress"
                value={`${stats.progressPct}%`}
                icon={Target}
                tone={stats.progressPct >= 100 ? "success" : "default"}
              />
              <StatCard
                label="Active time"
                value={formatHoursMinutes(stats.consistency.activeMinutes)}
                hint={`Goal ~${REQUIRED_ACTIVE_HOURS}h`}
                icon={Clock}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Today vs target</CardTitle>
            <CardDescription>
              {stats
                ? `${stats.appsToday} / ${stats.dailyTarget} applications · ${stats.today}`
                : "Loading…"}
            </CardDescription>
          </CardHeader>
          <CardContent>{stats ? <ProgressBar value={stats.progressPct} /> : <Skeleton className="h-4" />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="font-display text-lg">Consistency</CardTitle>
                <CardDescription>Based on apps you created today</CardDescription>
              </div>
              {stats ? (
                <Badge className={consistencyBadgeClass(stats.consistency.status)}>
                  {statusLabel(stats.consistency.status)}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {stats ? (
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Applications (yours)</dt>
                  <dd className="tabular-nums font-medium">{stats.consistency.totalApplications}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Active</dt>
                  <dd className="tabular-nums font-medium">
                    {formatHoursMinutes(stats.consistency.activeMinutes)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Break used</dt>
                  <dd className="tabular-nums font-medium">
                    {formatHoursMinutes(stats.consistency.breakUsedMinutes)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Window</dt>
                  <dd>
                    {stats.consistency.startTimeLabel} – {stats.consistency.lastApplicationLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <dt className="text-muted-foreground">Gaps</dt>
                  <dd className="text-muted-foreground">
                    {stats.consistency.slowGaps} slow · {stats.consistency.inactiveGaps} long
                    {stats.consistency.inactiveNow
                      ? ` · inactive ${stats.consistency.minutesSinceLastApp}m`
                      : ""}
                  </dd>
                </div>
              </dl>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Last 14 days</CardTitle>
            <CardDescription>Applications for your assigned students</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <TrendBars points={trend.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
