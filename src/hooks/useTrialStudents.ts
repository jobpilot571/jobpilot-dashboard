import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrialStatus } from "@/features/trials/constants";

export interface TrialStudent {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  visa_status: string;
  target_role: string;
  resume_url: string | null;
  signup_date: string;
  trial_end_date: string;
  assigned_to: string | null;
  assigned_at: string | null;
  trial_status: TrialStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useAllTrialStudents() {
  return useQuery({
    queryKey: ["trial-students", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_students")
        .select("*")
        .order("signup_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrialStudent[];
    },
  });
}

/** Apps completed for trial emails (match students by email, then count applications). */
export function useTrialAppCounts(emails: string[]) {
  const normalized = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))).sort();
  return useQuery({
    queryKey: ["trial-app-counts", normalized.join(",")],
    enabled: normalized.length > 0,
    queryFn: async () => {
      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, email")
        .in("email", normalized);
      // Emails may differ in casing in DB — also fetch broadly if needed
      if (sErr) {
        // Fallback: load all non-huge set by fetching trials' emails case-insensitive via ilike is hard in batch;
        // try without filter and map
        const all = await supabase.from("students").select("id, email");
        if (all.error) throw all.error;
        return buildCounts(all.data ?? [], normalized);
      }

      // Also include case-variant matches from a wider pull if few hits
      let rows = students ?? [];
      if (rows.length < normalized.length) {
        const all = await supabase.from("students").select("id, email");
        if (!all.error && all.data) {
          const wanted = new Set(normalized);
          rows = all.data.filter((s) => wanted.has(s.email.toLowerCase()));
        }
      }

      return buildCounts(rows, normalized);
    },
    staleTime: 30_000,
  });
}

async function buildCounts(
  students: { id: string; email: string }[],
  normalizedEmails: string[],
): Promise<Record<string, number>> {
  const emailToStudentIds: Record<string, string[]> = {};
  for (const s of students) {
    const key = s.email.toLowerCase();
    (emailToStudentIds[key] ??= []).push(s.id);
  }

  const studentIds = Object.values(emailToStudentIds).flat();
  const counts: Record<string, number> = Object.fromEntries(normalizedEmails.map((e) => [e, 0]));
  if (studentIds.length === 0) return counts;

  const { data: apps, error } = await supabase.from("job_applications").select("student_id").in("student_id", studentIds);
  if (error) throw error;

  const appsByStudent: Record<string, number> = {};
  for (const a of apps ?? []) {
    appsByStudent[a.student_id] = (appsByStudent[a.student_id] ?? 0) + 1;
  }

  for (const email of normalizedEmails) {
    const ids = emailToStudentIds[email] ?? [];
    counts[email] = ids.reduce((sum, id) => sum + (appsByStudent[id] ?? 0), 0);
  }
  return counts;
}
