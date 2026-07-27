import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";
import type { Student } from "@/lib/students";
import { parseProfileJson, type StudentProfileJson } from "@/lib/studentProfile";
import { getTodayCST, BUSINESS_TZ } from "@/lib/timezone";
import { toError } from "@/lib/errors";

const SELECT_FULL =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, joining_date, payment_status, payment_amount, payment_date, payment_method, payment_notes, last_active_at, profile_json";
const SELECT_BASE =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, profile_json";

export function useStudentById(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const full = await supabase.from("students").select(SELECT_FULL).eq("id", studentId!).maybeSingle();
      if (!full.error) return full.data as unknown as Student & { profile_json?: unknown };
      if (isMissingColumnError(full.error)) {
        const base = await supabase.from("students").select(SELECT_BASE).eq("id", studentId!).maybeSingle();
        if (base.error) throw toError(base.error);
        return base.data as unknown as Student & { profile_json?: unknown };
      }
      throw toError(full.error);
    },
  });
}

export interface StudentOverviewStats {
  todayApps: number;
  todayAssessments: number;
  todayScreening: number;
  todayTechnical: number;
  todayPanel: number;
  totalApps: number;
  totalAssessments: number;
  totalScreening: number;
  totalTechnical: number;
  totalPanel: number;
}

async function countApps(
  studentId: string,
  filters?: { appliedDate?: string; status?: string },
): Promise<number> {
  let q = supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if (filters?.appliedDate) q = q.eq("applied_date", filters.appliedDate);
  if (filters?.status) q = q.eq("status", filters.status);
  const { count, error } = await q;
  if (error) throw toError(error);
  return count ?? 0;
}

async function countPipelineStage(studentId: string, stage: string): Promise<number> {
  const { count, error } = await supabase
    .from("placement_pipeline_events")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("stage", stage);
  if (error) throw toError(error);
  return count ?? 0;
}

function chicagoDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date(iso));
}

export function useStudentOverviewStats(studentId: string | undefined) {
  const today = getTodayCST();
  return useQuery({
    queryKey: ["student-overview-stats", studentId, today],
    enabled: !!studentId,
    queryFn: async (): Promise<StudentOverviewStats> => {
      const id = studentId!;

      // Exact counts for apps — row selects are silently capped at 1000 by PostgREST.
      const [todayApps, totalApps, eventsRes, totalAssessments, totalScreening, totalTechnical, totalPanel] =
        await Promise.all([
          countApps(id, { appliedDate: today }),
          countApps(id),
          supabase
            .from("placement_pipeline_events")
            .select("stage, created_at")
            .eq("student_id", id)
            .in("stage", ["assessment", "screening", "technical", "panel"]),
          countPipelineStage(id, "assessment"),
          countPipelineStage(id, "screening"),
          countPipelineStage(id, "technical"),
          countPipelineStage(id, "panel"),
        ]);

      if (eventsRes.error) throw toError(eventsRes.error);
      const todayEvents = (eventsRes.data ?? []).filter(
        (e) => e.created_at && chicagoDateKey(e.created_at) === today,
      );
      const countToday = (stage: string) => todayEvents.filter((e) => e.stage === stage).length;

      return {
        todayApps,
        todayAssessments: countToday("assessment"),
        todayScreening: countToday("screening"),
        todayTechnical: countToday("technical"),
        todayPanel: countToday("panel"),
        totalApps,
        totalAssessments,
        totalScreening,
        totalTechnical,
        totalPanel,
      };
    },
  });
}

export function useSaveStudentProfile(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: StudentProfileJson) => {
      if (!studentId) throw new Error("Missing student");
      const { error } = await supabase
        .from("students")
        .update({ profile_json: profile as never })
        .eq("id", studentId);
      if (error) throw toError(error);
      return profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Profile saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save profile."),
  });
}

export function useParseResumeProfile(studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!studentId) throw new Error("Missing student");
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx"].includes(ext || "")) {
        throw new Error("Only PDF and DOCX files are accepted.");
      }

      try {
        const path = `auto-fill/${studentId}/${Date.now()}-${file.name}`;
        await supabase.storage.from("resumes").upload(path, file, { upsert: true });
      } catch {
        /* best-effort storage */
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("parse-resume-profile", {
        body: {
          student_id: studentId,
          file_name: file.name,
          file_base64: base64,
          mime_type: file.type || "application/pdf",
        },
      });
      if (error) throw toError(error, "Resume parsing failed.");
      const payload = data as { success?: boolean; profile?: StudentProfileJson; error?: string };
      if (!payload?.success || !payload.profile) {
        throw new Error(payload?.error || "Resume parsing failed. Upload a readable PDF or DOCX.");
      }
      return parseProfileJson(payload.profile);
    },
    onSuccess: async (profile) => {
      if (!studentId) return;
      const { error } = await supabase
        .from("students")
        .update({ profile_json: profile as never })
        .eq("id", studentId);
      if (error) throw toError(error);
      void queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Resume parsed and profile updated.");
    },
    onError: (err: Error) => toast.error(err.message || "Resume parse failed."),
  });
}
