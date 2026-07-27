import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError, type Employee } from "@/lib/employees";

const SELECT_FULL =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at, daily_target, joining_date, last_active_at";
const SELECT_BASE =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at";

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const full = await supabase.from("employees").select(SELECT_FULL).order("name");
      if (!full.error) return (full.data ?? []) as Employee[];
      if (isMissingColumnError(full.error)) {
        const base = await supabase.from("employees").select(SELECT_BASE).order("name");
        if (base.error) throw base.error;
        return (base.data ?? []) as Employee[];
      }
      throw full.error;
    },
  });
}
