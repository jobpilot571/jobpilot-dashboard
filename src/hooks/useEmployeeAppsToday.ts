import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTodayCST } from "@/lib/timezone";

export type EmployeeAppsTodayRow = {
  assigned: number;
  appsToday: number;
};

/** Today's application counts by employee and by student. */
export function useEmployeeAppsToday() {
  return useQuery({
    queryKey: ["employee-apps-today"],
    queryFn: async () => {
      const today = getTodayCST();

      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, assigned_to")
        .neq("status", "inactive");
      if (sErr) throw sErr;

      const { data: apps, error: aErr } = await supabase
        .from("job_applications")
        .select("student_id")
        .eq("applied_date", today);
      if (aErr) throw aErr;

      const byStudent: Record<string, number> = {};
      for (const a of apps ?? []) {
        byStudent[a.student_id] = (byStudent[a.student_id] ?? 0) + 1;
      }

      const byEmployee: Record<string, EmployeeAppsTodayRow> = {};
      for (const s of students ?? []) {
        if (!s.assigned_to) continue;
        if (!byEmployee[s.assigned_to]) byEmployee[s.assigned_to] = { assigned: 0, appsToday: 0 };
        byEmployee[s.assigned_to].assigned += 1;
        byEmployee[s.assigned_to].appsToday += byStudent[s.id] ?? 0;
      }

      return { byEmployee, byStudent, perStudentTargetDay: today };
    },
    refetchInterval: 60_000,
  });
}
