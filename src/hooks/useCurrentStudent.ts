import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";
import type { Student } from "@/lib/students";

const SELECT_FULL =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, joining_date, last_active_at, profile_json";
const SELECT_BASE =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at";

async function lookup(cols: string, userId: string, email: string | undefined) {
  const byId = await supabase.from("students").select(cols).eq("user_id", userId).maybeSingle();
  if (byId.error) return { error: byId.error, data: null as Student | null };
  if (byId.data) return { error: null, data: byId.data as unknown as Student };

  if (!email) return { error: null, data: null };

  const byEmail = await supabase.from("students").select(cols).eq("email", email).maybeSingle();
  if (byEmail.error) return { error: byEmail.error, data: null };
  if (!byEmail.data) return { error: null, data: null };

  const row = byEmail.data as unknown as Student;
  if (!row.user_id) {
    await supabase.from("students").update({ user_id: userId }).eq("id", row.id);
    row.user_id = userId;
  }
  return { error: null, data: row };
}

async function fetchStudentRow(userId: string, email: string | undefined): Promise<Student | null> {
  const full = await lookup(SELECT_FULL, userId, email);
  if (!full.error) return full.data;
  if (isMissingColumnError(full.error)) {
    const base = await lookup(SELECT_BASE, userId, email);
    if (base.error) throw base.error;
    return base.data;
  }
  throw full.error;
}

/** Resolve the logged-in student's `students` row (by user_id, then email). */
export function useCurrentStudent() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current-student", user?.id, user?.email],
    enabled: !!user?.id,
    queryFn: () => fetchStudentRow(user!.id, user!.email),
    staleTime: 60_000,
  });
}

export interface CounselorInfo {
  id: string;
  name: string;
  email: string;
  job_role_category: string;
}

export function useMyCounselor(assignedTo: string | null | undefined) {
  return useQuery({
    queryKey: ["my-counselor", assignedTo],
    enabled: !!assignedTo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, email, job_role_category")
        .eq("id", assignedTo!)
        .maybeSingle();
      if (error) throw error;
      return data as CounselorInfo | null;
    },
    staleTime: 60_000,
  });
}
