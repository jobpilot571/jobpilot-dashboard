import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getNowCST } from "@/lib/timezone";
import {
  DEFAULT_APPLICATION_SOURCE,
  isApplicationSource,
  type ApplicationSource,
} from "@/lib/applicationSources";

export interface JobApplication {
  id: string;
  student_id: string;
  serial_no: number;
  applied_date: string;
  applied_link: string;
  job_role: string;
  company_name: string;
  applied_time: string;
  applied_at: string;
  resume_file_url: string | null;
  status: string;
  created_by_employee_id: string | null;
  created_at: string;
  application_source?: ApplicationSource | string;
}

export const APP_STATUSES = [
  { value: "applied", label: "Applied" },
  { value: "incomplete", label: "Incomplete" },
  { value: "rejected", label: "Rejected" },
  { value: "forwarded", label: "Forwarded" },
] as const;

export type AppStatus = (typeof APP_STATUSES)[number]["value"];

/** Re-number 0/null serials chronologically so Sl works for older imports.
 * Skipped for large imports — mass UPDATEs on fetch were timing out and
 * making the apps list look empty for employees.
 */
async function repairSerialNumbersIfNeeded(
  studentId: string,
  rows: JobApplication[],
): Promise<JobApplication[]> {
  const broken = rows.filter((r) => !r.serial_no || r.serial_no <= 0);
  if (broken.length === 0 || broken.length > 40) return rows;

  const ordered = [...rows].sort(
    (a, b) =>
      new Date(a.applied_at || a.created_at).getTime() - new Date(b.applied_at || b.created_at).getTime(),
  );

  const patched: JobApplication[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i]!;
    const serial_no = i + 1;
    if (row.serial_no !== serial_no) {
      const { error } = await supabase
        .from("job_applications")
        .update({ serial_no })
        .eq("id", row.id)
        .eq("student_id", studentId);
      if (error) {
        console.warn("serial repair failed", row.id, error);
        patched.push(row);
        continue;
      }
    }
    patched.push({ ...row, serial_no });
  }
  return patched;
}

export function useJobApplications(studentId: string | undefined) {
  return useQuery({
    queryKey: ["job_applications", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const pageSize = 1000;
      const all: JobApplication[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("job_applications")
          .select("*")
          .eq("student_id", studentId!)
          .order("applied_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as JobApplication[];
        all.push(...rows);
        if (rows.length < pageSize) break;
      }
      return repairSerialNumbersIfNeeded(studentId!, all);
    },
  });
}

async function nextSerialNo(studentId: string): Promise<number> {
  const { data, error } = await supabase
    .from("job_applications")
    .select("serial_no")
    .eq("student_id", studentId)
    .order("serial_no", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = data?.[0]?.serial_no ?? 0;
  if (max > 0) return max + 1;

  const { count, error: countErr } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if (countErr) throw countErr;
  return (count ?? 0) + 1;
}

export function useAddJobApplication(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      applied_link: string;
      job_role: string;
      company_name: string;
      status: string;
      created_by_employee_id?: string | null;
      applied_date?: string;
      applied_time?: string;
      application_source?: ApplicationSource | string;
    }) => {
      if (!studentId) throw new Error("Select a student first.");
      const now = getNowCST();
      const serial_no = await nextSerialNo(studentId);
      const source = isApplicationSource(input.application_source)
        ? input.application_source
        : DEFAULT_APPLICATION_SOURCE;
      const baseRow = {
        student_id: studentId,
        serial_no,
        applied_date: input.applied_date ?? now.date,
        applied_time: input.applied_time ?? now.time,
        applied_link: input.applied_link,
        job_role: input.job_role,
        company_name: input.company_name,
        created_by_employee_id: input.created_by_employee_id ?? null,
        status: input.status,
      };
      const withSource = { ...baseRow, application_source: source };
      let { data, error } = await supabase.from("job_applications").insert(withSource).select().single();
      if (error && /application_source/i.test(error.message)) {
        const fallback = await supabase.from("job_applications").insert(baseRow).select().single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return data as JobApplication;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job_applications", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["employee-workspace-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["my-apps-history"] });
      void queryClient.invalidateQueries({ queryKey: ["student-app-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["student-overview-stats", studentId] });
      toast.success("Application saved.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add application.");
    },
  });
}

export function useUpdateJobApplication(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      updates: Partial<
        Pick<
          JobApplication,
          "applied_link" | "job_role" | "company_name" | "status" | "resume_file_url" | "application_source"
        >
      >;
    }) => {
      const { error } = await supabase.from("job_applications").update(input.updates).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job_applications", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["employee-workspace-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["my-apps-history"] });
      toast.success("Application updated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update application.");
    },
  });
}

export function useUploadApplicationResume(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { applicationId: string; file: File }) => {
      if (!studentId) throw new Error("Missing student");
      const ext = input.file.name.split(".").pop()?.toLowerCase() || "pdf";
      if (!["pdf", "docx", "doc"].includes(ext)) {
        throw new Error("Upload PDF or DOCX resume only.");
      }
      const path = `applications/${studentId}/${input.applicationId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, input.file, {
        upsert: true,
        contentType: input.file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("resumes").getPublicUrl(path);
      let resumeUrl = pub?.publicUrl ?? "";
      if (!resumeUrl) {
        const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(path, 60 * 60 * 24 * 365);
        resumeUrl = signed?.signedUrl ?? path;
      }

      const { error } = await supabase
        .from("job_applications")
        .update({ resume_file_url: resumeUrl })
        .eq("id", input.applicationId);
      if (error) throw error;
      return resumeUrl;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job_applications", studentId] });
      toast.success("Resume attached to this application.");
    },
    onError: (err: Error) => toast.error(err.message || "Resume upload failed."),
  });
}

export function useDeleteJobApplication(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["job_applications", studentId] });
      void queryClient.invalidateQueries({ queryKey: ["employee-workspace-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["my-apps-history"] });
      toast.success("Application removed.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete application.");
    },
  });
}

/** History across all assigned students. */
export function useMyApplicationsHistory(
  studentIds: string[],
  filters: { dateFrom: string; dateTo: string; studentId: string },
) {
  return useQuery({
    queryKey: ["my-apps-history", studentIds.join(","), filters],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("job_applications")
        .select("id, student_id, company_name, job_role, status, applied_date, applied_at, applied_link, applied_time")
        .gte("applied_date", filters.dateFrom)
        .lte("applied_date", filters.dateTo)
        .order("applied_at", { ascending: false })
        .limit(500);

      if (filters.studentId !== "all") {
        q = q.eq("student_id", filters.studentId);
      } else {
        q = q.in("student_id", studentIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
