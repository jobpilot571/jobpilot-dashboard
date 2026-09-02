import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";

export interface StartDateHistoryRow {
  id: string;
  student_id: string;
  old_date: string | null;
  new_date: string | null;
  changed_by: string | null;
  changed_by_name: string;
  changed_by_email: string;
  created_at: string;
}

export function useStartDateHistory(studentId: string | null) {
  return useQuery({
    queryKey: ["start-date-history", studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<StartDateHistoryRow[]> => {
      const { data, error } = await supabase
        .from("student_start_date_history")
        .select(
          "id, student_id, old_date, new_date, changed_by, changed_by_name, changed_by_email, created_at",
        )
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingColumnError(error)) return [];
        throw error;
      }
      return (data ?? []) as StartDateHistoryRow[];
    },
  });
}
