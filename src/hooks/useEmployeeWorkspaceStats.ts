import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { employeeEffectiveDailyTarget, type Employee } from "@/lib/employees";
import { computeConsistency, type ConsistencyStats } from "@/lib/consistency";
import { getTodayCST, getWeekRangeCST } from "@/lib/timezone";
import type { Student } from "@/lib/students";

export interface StudentDailyCount {
  studentId: string;
  studentName: string;
  count: number;
}

export interface EmployeeWorkspaceStats {
  today: string;
  week: { start: string; end: string };
  dailyTarget: number;
  appsToday: number;
  appsThisWeek: number;
  progressPct: number;
  docsPending: number;
  studentCounts: StudentDailyCount[];
  consistency: ConsistencyStats;
  recentApps: {
    id: string;
    studentId: string;
    studentName: string;
    company: string;
    role: string;
    status: string;
    appliedAt: string;
  }[];
}

export function useEmployeeWorkspaceStats(
  employee: Employee | null | undefined,
  students: Student[],
) {
  const today = getTodayCST();
  const week = getWeekRangeCST();
  const studentIds = students.map((s) => s.id);
  const nameById = Object.fromEntries(students.map((s) => [s.id, s.name]));

  return useQuery({
    queryKey: [
      "employee-workspace-stats",
      employee?.id,
      today,
      week.start,
      studentIds.join(","),
      employee?.daily_target,
    ],
    enabled: !!employee?.id,
    refetchInterval: 60_000,
    queryFn: async (): Promise<EmployeeWorkspaceStats> => {
      const eid = employee!.id;
      const dailyTarget = employeeEffectiveDailyTarget(employee!, students.length);

      const [todayByStudentRes, weekAppsRes, consistencyAppsRes, recentRes] = await Promise.all([
        studentIds.length
          ? supabase
              .from("job_applications")
              .select("student_id")
              .in("student_id", studentIds)
              .eq("applied_date", today)
          : Promise.resolve({ data: [] as { student_id: string }[], error: null }),
        studentIds.length
          ? supabase
              .from("job_applications")
              .select("id", { count: "exact", head: true })
              .in("student_id", studentIds)
              .gte("applied_date", week.start)
              .lte("applied_date", week.end)
          : Promise.resolve({ count: 0, error: null }),
        supabase
          .from("job_applications")
          .select("applied_at, student_id")
          .eq("created_by_employee_id", eid)
          .eq("applied_date", today),
        studentIds.length
          ? supabase
              .from("job_applications")
              .select("id, student_id, company_name, job_role, status, applied_at")
              .in("student_id", studentIds)
              .order("applied_at", { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (todayByStudentRes.error) throw todayByStudentRes.error;
      if (weekAppsRes.error) throw weekAppsRes.error;
      if (consistencyAppsRes.error) throw consistencyAppsRes.error;
      if (recentRes.error) throw recentRes.error;

      const countMap: Record<string, number> = {};
      for (const a of todayByStudentRes.data ?? []) {
        countMap[a.student_id] = (countMap[a.student_id] ?? 0) + 1;
      }
      const studentCounts: StudentDailyCount[] = students.map((s) => ({
        studentId: s.id,
        studentName: s.name,
        count: countMap[s.id] ?? 0,
      }));
      const appsToday = studentCounts.reduce((sum, s) => sum + s.count, 0);

      const consistency = computeConsistency(eid, employee!.name, consistencyAppsRes.data ?? []);

      return {
        today,
        week,
        dailyTarget,
        appsToday,
        appsThisWeek: weekAppsRes.count ?? 0,
        progressPct: dailyTarget > 0 ? Math.round((appsToday / dailyTarget) * 100) : 0,
        docsPending: students.filter((s) => s.documents_submitted < s.documents_total).length,
        studentCounts,
        consistency,
        recentApps: (recentRes.data ?? []).map((a) => ({
          id: a.id,
          studentId: a.student_id,
          studentName: nameById[a.student_id] ?? "—",
          company: a.company_name,
          role: a.job_role,
          status: a.status,
          appliedAt: a.applied_at,
        })),
      };
    },
  });
}
