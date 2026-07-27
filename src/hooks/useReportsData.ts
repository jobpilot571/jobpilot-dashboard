import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { employeeEffectiveDailyTarget, type Employee } from "@/lib/employees";
import { getStudentBucket, type Student } from "@/lib/students";
import { computeConsistency, type ConsistencyStats } from "@/lib/consistency";
import { getTodayCST, getWeekRangeCST } from "@/lib/timezone";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  employeeId: string; // "all" | id
  studentId: string; // "all" | id
}

export interface DailyPoint {
  date: string;
  count: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface EmployeePerfRow {
  employeeId: string;
  name: string;
  assignedStudents: number;
  appsInRange: number;
  appsToday: number;
  dailyTarget: number;
  progressPct: number;
  consistency: ConsistencyStats;
}

export interface StudentPerfRow {
  studentId: string;
  name: string;
  program: string;
  assignedTo: string;
  appsInRange: number;
  interviews: number;
  bucket: string;
}

export interface ReportsPayload {
  filters: ReportFilters;
  today: string;
  week: { start: string; end: string };
  kpis: {
    appsInRange: number;
    appsToday: number;
    appsThisWeek: number;
    interviews: number;
    placements: number;
    studentsTotal: number;
    studentsActive: number;
    studentsInactive: number;
    studentsAssigned: number;
    studentsUnassigned: number;
    employeesActive: number;
  };
  trendDaily: DailyPoint[];
  byRole: NamedCount[];
  byCompany: NamedCount[];
  employeePerf: EmployeePerfRow[];
  studentPerf: StudentPerfRow[];
  sourceNote: string;
}

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

function defaultFilters(): ReportFilters {
  const today = getTodayCST();
  return {
    dateFrom: addDays(today, -29),
    dateTo: today,
    employeeId: "all",
    studentId: "all",
  };
}

export function useReportFiltersDefaults(): ReportFilters {
  return useMemo(() => defaultFilters(), []);
}

type AppRow = {
  id: string;
  student_id: string;
  company_name: string;
  job_role: string;
  status: string;
  applied_date: string;
  applied_at: string;
  created_by_employee_id: string | null;
};

export function useReportsData(filters: ReportFilters, employees: Employee[], students: Student[]) {
  const today = getTodayCST();
  const week = getWeekRangeCST();

  return useQuery({
    queryKey: ["reports", filters, employees.map((e) => e.id).join(","), students.length],
    enabled: employees.length >= 0,
    queryFn: async (): Promise<ReportsPayload> => {
      const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

      // Narrow student set by employee filter first
      let scopedStudents = students;
      if (filters.employeeId !== "all") {
        scopedStudents = students.filter((s) => s.assigned_to === filters.employeeId);
      }
      if (filters.studentId !== "all") {
        scopedStudents = scopedStudents.filter((s) => s.id === filters.studentId);
      }
      const scopedStudentIds = new Set(scopedStudents.map((s) => s.id));

      const scopedIdList = [...scopedStudentIds];
      const scopeApps = filters.studentId !== "all" || filters.employeeId !== "all";

      // When scoped, push filters to PostgREST (empty scope → no fetch)
      const emptyScope = scopeApps && scopedIdList.length === 0;

      const appsQuery = () => {
        if (emptyScope) return Promise.resolve({ data: [] as AppRow[], error: null });
        let q = supabase
          .from("job_applications")
          .select(
            "id, student_id, company_name, job_role, status, applied_date, applied_at, created_by_employee_id",
          )
          .gte("applied_date", filters.dateFrom)
          .lte("applied_date", filters.dateTo);
        if (scopeApps) q = q.in("student_id", scopedIdList);
        return q;
      };

      const interviewQuery = () => {
        if (emptyScope) return Promise.resolve({ data: [] as { id: string; student_id: string }[], error: null });
        let q = supabase
          .from("placement_pipeline_events")
          .select("id, student_id")
          .in("stage", ["screening", "technical", "panel"])
          .gte("created_at", `${filters.dateFrom}T00:00:00`)
          .lte("created_at", `${filters.dateTo}T23:59:59`);
        if (scopeApps) q = q.in("student_id", scopedIdList);
        return q;
      };

      const placementQuery = () => {
        if (emptyScope) return Promise.resolve({ data: [] as { id: string; student_id: string }[], error: null });
        let q = supabase
          .from("placement_pipeline_events")
          .select("id, student_id")
          .eq("stage", "offer")
          .gte("created_at", `${filters.dateFrom}T00:00:00`)
          .lte("created_at", `${filters.dateTo}T23:59:59`);
        if (scopeApps) q = q.in("student_id", scopedIdList);
        return q;
      };

      const consistencyQuery = () => {
        let q = supabase
          .from("job_applications")
          .select("created_by_employee_id, applied_at, applied_date, student_id")
          .eq("applied_date", today);
        if (filters.employeeId !== "all") {
          q = q.eq("created_by_employee_id", filters.employeeId);
        }
        return q;
      };

      const [appsRes, interviewRes, placementRes, todayConsistencyAppsRes] = await Promise.all([
        appsQuery(),
        interviewQuery(),
        placementQuery(),
        consistencyQuery(),
      ]);

      if (appsRes.error) throw appsRes.error;
      if (interviewRes.error) throw interviewRes.error;
      if (placementRes.error) throw placementRes.error;
      if (todayConsistencyAppsRes.error) throw todayConsistencyAppsRes.error;

      const apps = (appsRes.data ?? []) as AppRow[];
      const interviews = interviewRes.data ?? [];
      const placements = placementRes.data ?? [];

      const appsTodayAll = apps.filter((a) => a.applied_date === today).length;
      const appsWeekAll = apps.filter((a) => a.applied_date >= week.start && a.applied_date <= week.end).length;

      // Student status KPIs (global operational, optionally scoped by employee)
      const statusStudents =
        filters.employeeId === "all"
          ? students
          : students.filter((s) => s.assigned_to === filters.employeeId);
      let assigned = 0;
      let unassigned = 0;
      let inactive = 0;
      for (const s of statusStudents) {
        const b = getStudentBucket(s);
        if (b === "inactive") inactive += 1;
        else if (b === "assigned") assigned += 1;
        else unassigned += 1;
      }
      const studentsActive = assigned + unassigned;

      const dates = eachDate(filters.dateFrom, filters.dateTo);
      const byDate: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
      for (const a of apps) byDate[a.applied_date] = (byDate[a.applied_date] ?? 0) + 1;
      const trendDaily: DailyPoint[] = dates.map((date) => ({ date, count: byDate[date] ?? 0 }));

      const roleMap: Record<string, number> = {};
      const companyMap: Record<string, number> = {};
      for (const a of apps) {
        const role = (a.job_role || "Unknown").trim() || "Unknown";
        const company = (a.company_name || "Unknown").trim() || "Unknown";
        roleMap[role] = (roleMap[role] ?? 0) + 1;
        companyMap[company] = (companyMap[company] ?? 0) + 1;
      }
      const byRole = Object.entries(roleMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      const byCompany = Object.entries(companyMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      // Apps in range by assigned employee (via student assignment)
      const appsByStudent: Record<string, number> = {};
      for (const a of apps) appsByStudent[a.student_id] = (appsByStudent[a.student_id] ?? 0) + 1;

      const todayAppsByCreated: Record<string, AppRow[]> = {};
      for (const a of (todayConsistencyAppsRes.data ?? []) as AppRow[]) {
        const eid = a.created_by_employee_id;
        if (!eid) continue;
        (todayAppsByCreated[eid] ??= []).push(a);
      }

      // Also map today's apps by assigned student for target progress
      const todayAppsByStudent: Record<string, number> = {};
      for (const a of (todayConsistencyAppsRes.data ?? []) as { student_id: string }[]) {
        todayAppsByStudent[a.student_id] = (todayAppsByStudent[a.student_id] ?? 0) + 1;
      }

      const activeEmployees = employees.filter((e) => e.status !== "inactive");
      const employeePerf: EmployeePerfRow[] = activeEmployees
        .filter((e) => filters.employeeId === "all" || e.id === filters.employeeId)
        .map((e) => {
          const assignedList = students.filter((s) => s.assigned_to === e.id && s.status !== "inactive");
          const appsInRange = assignedList.reduce((sum, s) => sum + (appsByStudent[s.id] ?? 0), 0);
          const appsToday = assignedList.reduce((sum, s) => sum + (todayAppsByStudent[s.id] ?? 0), 0);
          const dailyTarget = employeeEffectiveDailyTarget(e, assignedList.length);
          const consistency = computeConsistency(e.id, e.name, todayAppsByCreated[e.id] ?? []);
          return {
            employeeId: e.id,
            name: e.name,
            assignedStudents: assignedList.length,
            appsInRange,
            appsToday,
            dailyTarget,
            progressPct: dailyTarget > 0 ? Math.round((appsToday / dailyTarget) * 100) : 0,
            consistency,
          };
        })
        .sort((a, b) => b.appsInRange - a.appsInRange);

      const interviewByStudent: Record<string, number> = {};
      for (const ev of interviews) {
        if (!ev.student_id) continue;
        interviewByStudent[ev.student_id] = (interviewByStudent[ev.student_id] ?? 0) + 1;
      }

      const studentPerf: StudentPerfRow[] = scopedStudents
        .filter((s) => filters.studentId === "all" || s.id === filters.studentId)
        .map((s) => ({
          studentId: s.id,
          name: s.name,
          program: s.program || "—",
          assignedTo: s.assigned_to ? empById[s.assigned_to]?.name ?? "—" : "Unassigned",
          appsInRange: appsByStudent[s.id] ?? 0,
          interviews: interviewByStudent[s.id] ?? 0,
          bucket: getStudentBucket(s),
        }))
        .sort((a, b) => b.appsInRange - a.appsInRange)
        .slice(0, 50);

      return {
        filters,
        today,
        week,
        kpis: {
          appsInRange: apps.length,
          appsToday: appsTodayAll,
          appsThisWeek: appsWeekAll,
          interviews: interviews.length,
          placements: placements.length,
          studentsTotal: statusStudents.length,
          studentsActive,
          studentsInactive: inactive,
          studentsAssigned: assigned,
          studentsUnassigned: unassigned,
          employeesActive: activeEmployees.length,
        },
        trendDaily,
        byRole,
        byCompany,
        employeePerf,
        studentPerf,
        sourceNote: "Application source is not stored in job_applications yet — by-source report deferred.",
      };
    },
    staleTime: 30_000,
  });
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
