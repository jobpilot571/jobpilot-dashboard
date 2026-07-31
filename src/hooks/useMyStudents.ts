import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";
import type { Student } from "@/lib/students";

const SELECT_FULL =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, joining_date, last_active_at";
const SELECT_BASE =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at";

/** Students for the current employee — assigned only, or all if can_access_all_students. */
export function useMyStudents(
  employeeId: string | undefined,
  opts?: { includeInactive?: boolean; accessAllStudents?: boolean },
) {
  const includeInactive = opts?.includeInactive ?? false;
  const accessAll = opts?.accessAllStudents ?? false;

  return useQuery({
    queryKey: ["my-students", employeeId, includeInactive, accessAll],
    enabled: !!employeeId,
    queryFn: async () => {
      const run = async (cols: string) => {
        let q = supabase.from("students").select(cols).order("name");
        if (!accessAll) q = q.eq("assigned_to", employeeId!);
        if (!includeInactive) q = q.neq("status", "inactive");
        return q;
      };

      const full = await run(SELECT_FULL);
      if (!full.error) return (full.data ?? []) as unknown as Student[];
      if (isMissingColumnError(full.error)) {
        const base = await run(SELECT_BASE);
        if (base.error) throw base.error;
        return (base.data ?? []) as unknown as Student[];
      }
      throw full.error;
    },
  });
}
