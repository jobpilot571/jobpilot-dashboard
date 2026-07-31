import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentAppStats {
  appCount: number;
  interviewCount: number;
}

async function exactAppCounts(studentIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const chunkSize = 20;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (id) => {
        const { count, error } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("student_id", id);
        if (error) throw error;
        counts[id] = count ?? 0;
      }),
    );
  }
  return counts;
}

async function exactInterviewCounts(studentIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const chunkSize = 20;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (id) => {
        const { count, error } = await supabase
          .from("placement_pipeline_events")
          .select("id", { count: "exact", head: true })
          .eq("student_id", id)
          .in("stage", ["screening", "technical", "panel"]);
        if (error) throw error;
        counts[id] = count ?? 0;
      }),
    );
  }
  return counts;
}

/**
 * Application totals + interview-stage pipeline counts per student.
 * Uses exact head counts so totals are not capped by PostgREST's default 1000-row page.
 * Pass `studentIds` to scope the query (required for employee workspace).
 * Omit / pass undefined for admin (loads all student ids first).
 */
export function useStudentAppStats(studentIds?: string[]) {
  const scoped = studentIds !== undefined;
  const idKey = scoped ? studentIds.join(",") : "all";

  return useQuery({
    queryKey: ["student-app-stats", idKey],
    enabled: !scoped || studentIds.length > 0,
    queryFn: async () => {
      let ids = studentIds ?? [];
      if (!scoped) {
        // Paginate student ids (default page is 1000)
        const all: string[] = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from("students")
            .select("id")
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const rows = data ?? [];
          all.push(...rows.map((r) => r.id));
          if (rows.length < pageSize) break;
        }
        ids = all;
      }
      if (ids.length === 0) return {} as Record<string, StudentAppStats>;

      const [appCounts, interviewCounts] = await Promise.all([
        exactAppCounts(ids),
        exactInterviewCounts(ids),
      ]);

      const map: Record<string, StudentAppStats> = {};
      for (const id of ids) {
        map[id] = {
          appCount: appCounts[id] ?? 0,
          interviewCount: interviewCounts[id] ?? 0,
        };
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
