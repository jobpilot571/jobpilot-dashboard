import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentAppStats {
  appCount: number;
  interviewCount: number;
}

/**
 * Application totals + interview-stage pipeline counts per student.
 * Pass `studentIds` to scope the query (required for employee workspace).
 * Omit / pass undefined for admin (all students visible via RLS).
 */
export function useStudentAppStats(studentIds?: string[]) {
  const scoped = studentIds !== undefined;
  const idKey = scoped ? studentIds.join(",") : "all";

  return useQuery({
    queryKey: ["student-app-stats", idKey],
    enabled: !scoped || studentIds.length > 0,
    queryFn: async () => {
      if (scoped && studentIds.length === 0) return {} as Record<string, StudentAppStats>;

      let appsQ = supabase.from("job_applications").select("student_id");
      let interviewsQ = supabase
        .from("placement_pipeline_events")
        .select("student_id")
        .in("stage", ["screening", "technical", "panel"]);

      if (scoped) {
        appsQ = appsQ.in("student_id", studentIds);
        interviewsQ = interviewsQ.in("student_id", studentIds);
      }

      const [appsRes, interviewsRes] = await Promise.all([appsQ, interviewsQ]);
      if (appsRes.error) throw appsRes.error;
      if (interviewsRes.error) throw interviewsRes.error;

      const map: Record<string, StudentAppStats> = {};
      for (const row of appsRes.data ?? []) {
        if (!map[row.student_id]) map[row.student_id] = { appCount: 0, interviewCount: 0 };
        map[row.student_id].appCount += 1;
      }
      for (const row of interviewsRes.data ?? []) {
        if (!map[row.student_id]) map[row.student_id] = { appCount: 0, interviewCount: 0 };
        map[row.student_id].interviewCount += 1;
      }
      return map;
    },
    staleTime: 30_000,
  });
}

export function useStudentApplications(studentId: string | undefined) {
  return useQuery({
    queryKey: ["job_applications", "student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("id, company_name, job_role, status, applied_date, applied_at, applied_link")
        .eq("student_id", studentId!)
        .order("applied_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });
}
