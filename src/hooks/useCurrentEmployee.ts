import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError, type Employee } from "@/lib/employees";

const SELECT_FULL =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at, daily_target, joining_date, last_active_at, can_access_all_students, is_team_lead";
const SELECT_BASE =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at";

async function lookup(cols: string, userId: string, email: string | undefined) {
  const byId = await supabase.from("employees").select(cols).eq("user_id", userId).maybeSingle();
  if (byId.error) return { error: byId.error, data: null as Employee | null };
  if (byId.data) return { error: null, data: byId.data as unknown as Employee };

  if (!email) return { error: null, data: null };

  const byEmail = await supabase.from("employees").select(cols).eq("email", email).maybeSingle();
  if (byEmail.error) return { error: byEmail.error, data: null };
  if (!byEmail.data) return { error: null, data: null };

  const row = byEmail.data as unknown as Employee;
  if (!row.user_id) {
    await supabase.from("employees").update({ user_id: userId }).eq("id", row.id);
    row.user_id = userId;
  }
  return { error: null, data: row };
}

async function fetchEmployeeRow(userId: string, email: string | undefined): Promise<Employee | null> {
  const full = await lookup(SELECT_FULL, userId, email);
  if (!full.error) return full.data;
  if (isMissingColumnError(full.error)) {
    const base = await lookup(SELECT_BASE, userId, email);
    if (base.error) throw base.error;
    return base.data;
  }
  throw full.error;
}

/** Resolve the logged-in employee's `employees` row (by user_id, then email). */
export function useCurrentEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-employee", user?.id, user?.email],
    enabled: !!user?.id,
    queryFn: () => fetchEmployeeRow(user!.id, user!.email),
    staleTime: 60_000,
  });
}
