import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Layers,
  Mic2,
  Users,
} from "lucide-react";
import type { StudentOverviewStats } from "@/hooks/useStudentProfile";
import type { Student } from "@/lib/students";
import { format } from "date-fns";

export function StudentOverviewTab({
  student,
  stats,
  loading,
}: {
  student: Student;
  stats?: StudentOverviewStats;
  loading: boolean;
}) {
  const join =
    student.joining_date ||
    student.applied_date ||
    (student.created_at ? format(new Date(student.created_at), "yyyy-MM-dd") : "—");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Today
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {loading || !stats ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard label="Applications" value={stats.todayApps} icon={Briefcase} />
              <StatCard label="Assessments" value={stats.todayAssessments} icon={ClipboardCheck} tone="info" />
              <StatCard label="Screening" value={stats.todayScreening} icon={Users} />
              <StatCard label="Technical" value={stats.todayTechnical} icon={Mic2} tone="info" />
              <StatCard label="Panel" value={stats.todayPanel} icon={Layers} tone="warning" />
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          All time
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {loading || !stats ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard label="Total applications" value={stats.totalApps} icon={Briefcase} />
              <StatCard label="Total assessments" value={stats.totalAssessments} icon={ClipboardCheck} tone="info" />
              <StatCard label="Screening" value={stats.totalScreening} icon={Users} />
              <StatCard label="Technical" value={stats.totalTechnical} icon={Mic2} tone="info" />
              <StatCard label="Panel" value={stats.totalPanel} icon={Layers} tone="warning" />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
            <span className="text-muted-foreground">Join / applied date</span>
            <span className="font-medium tabular-nums">{join}</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
            <span className="text-muted-foreground">Program</span>
            <span className="font-medium">{student.program || "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
