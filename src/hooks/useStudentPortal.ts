import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_STATUSES, type JobApplication } from "@/hooks/useJobApplications";
import { getTodayCST, getWeekRangeCST } from "@/lib/timezone";
import { PLACEMENT_STAGES } from "@/lib/constants";

export interface StudentPortalStats {
  today: string;
  week: { start: string; end: string };
  appsTotal: number;
  appsToday: number;
  appsThisWeek: number;
  interviews: number;
  offers: number;
  byStatus: { status: string; label: string; count: number }[];
  byStage: { stage: string; label: string; count: number }[];
  recentApps: JobApplication[];
}

export function useStudentPortalStats(studentId: string | undefined) {
  const today = getTodayCST();
  const week = getWeekRangeCST();

  return useQuery({
    queryKey: ["student-portal-stats", studentId, today, week.start],
    enabled: !!studentId,
    queryFn: async (): Promise<StudentPortalStats> => {
      const sid = studentId!;
      const [appsRes, pipelineRes] = await Promise.all([
        supabase
          .from("job_applications")
          .select("*")
          .eq("student_id", sid)
          .order("applied_at", { ascending: false }),
        supabase.from("placement_pipeline_events").select("stage").eq("student_id", sid),
      ]);
      if (appsRes.error) throw appsRes.error;
      if (pipelineRes.error) throw pipelineRes.error;

      const apps = (appsRes.data ?? []) as JobApplication[];
      const statusMap: Record<string, number> = {};
      for (const a of apps) statusMap[a.status] = (statusMap[a.status] ?? 0) + 1;

      const byStatus: { status: string; label: string; count: number }[] = APP_STATUSES.map((s) => ({
        status: s.value,
        label: s.label,
        count: statusMap[s.value] ?? 0,
      }));
      // Include unknown statuses if present
      for (const [status, count] of Object.entries(statusMap)) {
        if (!APP_STATUSES.some((s) => s.value === status)) {
          byStatus.push({ status, label: status, count });
        }
      }

      const stageMap: Record<string, number> = {};
      for (const e of pipelineRes.data ?? []) {
        stageMap[e.stage] = (stageMap[e.stage] ?? 0) + 1;
      }
      const byStage = PLACEMENT_STAGES.map((s) => ({
        stage: s.key,
        label: s.label,
        count: stageMap[s.key] ?? 0,
      }));

      const interviews = (pipelineRes.data ?? []).filter((e) =>
        ["screening", "technical", "panel"].includes(e.stage),
      ).length;
      const offers = stageMap.offer ?? 0;

      return {
        today,
        week,
        appsTotal: apps.length,
        appsToday: apps.filter((a) => a.applied_date === today).length,
        appsThisWeek: apps.filter((a) => a.applied_date >= week.start && a.applied_date <= week.end)
          .length,
        interviews,
        offers,
        byStatus,
        byStage,
        recentApps: apps.slice(0, 10),
      };
    },
  });
}

export interface StudentDocumentRow {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  status: string;
  uploaded_at: string;
}

export function useStudentDocuments(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-documents", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_detail_documents")
        .select("id, document_type, file_name, file_path, file_size, mime_type, status, uploaded_at")
        .eq("student_id", studentId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentDocumentRow[];
    },
  });
}
