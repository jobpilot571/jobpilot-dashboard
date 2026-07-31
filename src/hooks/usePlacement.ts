import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineStage } from "@/features/placement/constants";

export interface PipelineEvent {
  id: string;
  student_id: string;
  employee_id: string | null;
  stage: PipelineStage;
  company_name: string | null;
  job_role: string | null;
  event_link: string | null;
  recruiter_name: string | null;
  recruiter_email: string | null;
  phone_number: string | null;
  event_date: string | null;
  event_time: string | null;
  due_date: string | null;
  status: string | null;
  result: string | null;
  completed: boolean | null;
  salary_or_rate: string | null;
  employment_type: string | null;
  joining_date: string | null;
  interview_mode: string | null;
  interviewer_name: string | null;
  panel_members: string | null;
  screenshot_url: string | null;
  document_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlacementSummaryRow {
  student_id: string;
  student_name: string;
  student_email: string;
  joined_date: string | null;
  student_status: string | null;
  assigned_employee_id: string | null;
  employee_name: string | null;
  total_applications: number;
  last_application_at: string | null;
  assessment_count: number;
  screening_count: number;
  technical_count: number;
  panel_count: number;
  offer_count: number;
  last_pipeline_at: string | null;
  last_interview_offer_at: string | null;
  last_early_stage_at: string | null;
  has_overdue_assessment: boolean;
  has_needs_update: boolean;
}

export function usePipelineEvents() {
  return useQuery({
    queryKey: ["pipeline_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_pipeline_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PipelineEvent[];
    },
  });
}

export function useStudentPipelineEvents(studentId: string | undefined) {
  return useQuery({
    queryKey: ["pipeline_events", "student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placement_pipeline_events")
        .select("*")
        .eq("student_id", studentId!)
        .in("stage", ["assessment", "ai_screening", "screening", "technical", "panel"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PipelineEvent[];
    },
  });
}

export function usePlacementSummary() {
  return useQuery({
    queryKey: ["student_placement_summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_placement_summary")
        .select("*")
        .order("student_name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        student_id: String(r.student_id ?? ""),
        student_name: String(r.student_name ?? ""),
        student_email: String(r.student_email ?? ""),
        joined_date: (r.joined_date as string | null) ?? null,
        student_status: (r.student_status as string | null) ?? null,
        assigned_employee_id: (r.assigned_employee_id as string | null) ?? null,
        employee_name: (r.employee_name as string | null) ?? null,
        total_applications: Number(r.total_applications) || 0,
        last_application_at: (r.last_application_at as string | null) ?? null,
        assessment_count: Number(r.assessment_count) || 0,
        screening_count: Number(r.screening_count) || 0,
        technical_count: Number(r.technical_count) || 0,
        panel_count: Number(r.panel_count) || 0,
        offer_count: Number(r.offer_count) || 0,
        last_pipeline_at: (r.last_pipeline_at as string | null) ?? null,
        last_interview_offer_at: (r.last_interview_offer_at as string | null) ?? null,
        last_early_stage_at: (r.last_early_stage_at as string | null) ?? null,
        has_overdue_assessment: Boolean(r.has_overdue_assessment),
        has_needs_update: Boolean(r.has_needs_update),
      })) as PlacementSummaryRow[];
    },
  });
}

export function usePlacementTotals() {
  return useQuery({
    queryKey: ["placement_totals"],
    queryFn: async () => {
      const [appsRes, studentsRes, assessmentRes, screeningRes, technicalRes, panelRes, offerRes] =
        await Promise.all([
          supabase.from("job_applications").select("*", { count: "exact", head: true }),
          supabase.from("students").select("*", { count: "exact", head: true }).neq("status", "inactive"),
          supabase
            .from("placement_pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "assessment"),
          supabase
            .from("placement_pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "screening"),
          supabase
            .from("placement_pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "technical"),
          supabase
            .from("placement_pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "panel"),
          supabase
            .from("placement_pipeline_events")
            .select("*", { count: "exact", head: true })
            .eq("stage", "offer"),
        ]);

      for (const res of [appsRes, studentsRes, assessmentRes, screeningRes, technicalRes, panelRes, offerRes]) {
        if (res.error) throw res.error;
      }

      return {
        apps: appsRes.count ?? 0,
        activeStudents: studentsRes.count ?? 0,
        assessment: assessmentRes.count ?? 0,
        screening: screeningRes.count ?? 0,
        technical: technicalRes.count ?? 0,
        panel: panelRes.count ?? 0,
        offer: offerRes.count ?? 0,
      };
    },
  });
}

type UpsertPayload = Partial<PipelineEvent> & { stage: PipelineStage; student_id: string };

export function useUpsertPipelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from("placement_pipeline_events").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from("placement_pipeline_events").insert({
          ...rest,
          created_by: auth.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pipeline_events"] }),
        qc.invalidateQueries({ queryKey: ["student_placement_summary"] }),
        qc.invalidateQueries({ queryKey: ["placement_totals"] }),
        qc.invalidateQueries({ queryKey: ["student-app-stats"] }),
        qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["student-overview-stats"] }),
      ]);
    },
  });
}

export function useDeletePipelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("placement_pipeline_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["pipeline_events"] }),
        qc.invalidateQueries({ queryKey: ["student_placement_summary"] }),
        qc.invalidateQueries({ queryKey: ["placement_totals"] }),
        qc.invalidateQueries({ queryKey: ["student-app-stats"] }),
        qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] }),
        qc.invalidateQueries({ queryKey: ["student-overview-stats"] }),
      ]);
    },
  });
}

/** Upload a forwarded-email screenshot into the resumes bucket (screenshots/ prefix). */
export function useUploadPipelineScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { eventId: string; studentId: string; file: File }) => {
      const ext = input.file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `screenshots/${input.studentId}/${input.eventId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, input.file, {
        upsert: true,
        contentType: input.file.type || "image/png",
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("resumes").getPublicUrl(path);
      let url = pub?.publicUrl ?? "";
      if (!url) {
        const { data: signed } = await supabase.storage
          .from("resumes")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        url = signed?.signedUrl ?? "";
      }
      if (!url) throw new Error("Could not get screenshot URL");
      const { error } = await supabase
        .from("placement_pipeline_events")
        .update({ screenshot_url: url })
        .eq("id", input.eventId);
      if (error) throw error;
      return url;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pipeline_events"] });
    },
  });
}
