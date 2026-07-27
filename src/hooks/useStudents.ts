import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";
import type { Student } from "@/lib/students";

const SELECT_FULL =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, joining_date, payment_status, payment_amount, payment_date, payment_method, payment_notes, last_active_at";
const SELECT_BASE =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const full = await supabase.from("students").select(SELECT_FULL).order("name");
      if (!full.error) return (full.data ?? []) as Student[];
      if (isMissingColumnError(full.error)) {
        const base = await supabase.from("students").select(SELECT_BASE).order("name");
        if (base.error) throw base.error;
        return (base.data ?? []) as Student[];
      }
      throw full.error;
    },
  });
}
