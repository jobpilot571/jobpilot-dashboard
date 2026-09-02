import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { employeeEffectiveDailyTarget, isMissingColumnError, type Employee } from "@/lib/employees";
import { getStudentBucket, type Student } from "@/lib/students";
import { getTodayCST, getWeekRangeCST } from "@/lib/timezone";
import { toError } from "@/lib/errors";

export interface DashboardAlert {
  id: string;
  tone: "warning" | "danger" | "info";
  title: string;
  detail: string;
}

export interface EmployeePerformanceRow {
  employeeId: string;
  name: string;
  status: string;
  assignedStudents: number;
  appsToday: number;
  dailyTarget: number;
  progressPct: number;
}

export interface RecentActivityItem {
  id: string;
  studentId: string;
  studentName: string;
  company: string;
  role: string;
  status: string;
  appliedAt: string;
  appliedDate: string;
}

export interface AdminDashboardStats {
  migrationPending: boolean;
  employees: {
    total: number;
    active: number;
    inactive: number;
  };
  students: {
    total: number;
    active: number;
    inactive: number;
    assigned: number;
    unassigned: number;
  };
  freeTrials: {
    total: number;
    active: number;
    expiringSoon: number;
  };
  applications: {
    today: number;
    week: number;
  };
  interviews: number;
  placements: number;
  pipeline: {
    assessment: number;
    screening: number;
    technical: number;
    panel: number;
  };
  studentStatusSummary: {
    assigned: number;
    unassigned: number;
    inactive: number;
  };
  employeePerformance: EmployeePerformanceRow[];
  recentActivity: RecentActivityItem[];
  alerts: DashboardAlert[];
}

const EMPLOYEE_SELECT_FULL =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at, daily_target, joining_date, last_active_at";
const EMPLOYEE_SELECT_BASE =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at";

const STUDENT_SELECT_FULL =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at, joining_date, payment_status, last_active_at";
const STUDENT_SELECT_BASE =
  "id, name, email, phone, program, status, assigned_to, last_assigned_to, inactive_at, inactive_reason, user_id, applied_date, documents_submitted, documents_total, created_at";

async function fetchEmployees(): Promise<{ rows: Employee[]; migrationPending: boolean }> {
  const full = await supabase.from("employees").select(EMPLOYEE_SELECT_FULL).order("name");
  if (!full.error) {
    return { rows: (full.data ?? []) as unknown as Employee[], migrationPending: false };
  }
  if (isMissingColumnError(full.error)) {
    const base = await supabase.from("employees").select(EMPLOYEE_SELECT_BASE).order("name");
    if (base.error) throw toError(base.error, "Failed to load employees");
    return { rows: (base.data ?? []) as unknown as Employee[], migrationPending: true };
  }
  throw toError(full.error, "Failed to load employees");
}

async function fetchStudents(): Promise<{ rows: Student[]; migrationPending: boolean }> {
  const full = await supabase.from("students").select(STUDENT_SELECT_FULL).order("name");
  if (!full.error) {
    return { rows: (full.data ?? []) as unknown as Student[], migrationPending: false };
  }
  if (isMissingColumnError(full.error)) {
    const base = await supabase.from("students").select(STUDENT_SELECT_BASE).order("name");
    if (base.error) throw toError(base.error, "Failed to load students");
    return { rows: (base.data ?? []) as unknown as Student[], migrationPending: true };
  }
  throw toError(full.error, "Failed to load students");
}

async function countOrZero(
  promise: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
): Promise<number> {
  const res = await promise;
  if (res.error) {
    console.warn("Dashboard count query failed:", res.error);
    return 0;
  }
  return res.count ?? 0;
}

function addDaysCST(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async (): Promise<AdminDashboardStats> => {
      try {
        const today = getTodayCST();
        const week = getWeekRangeCST();
        const soon = addDaysCST(today, 3);

        const [employeesRes, studentsRes] = await Promise.all([fetchEmployees(), fetchStudents()]);

        const [trialsRes, appsToday, appsWeek, interviews, placements, assessmentCount, screeningCount, technicalCount, panelCount, recentAppsRes, todayAppsRes] =
          await Promise.all([
            supabase.from("trial_students").select("id, trial_status, trial_end_date, full_name"),
            countOrZero(
              supabase
                .from("job_applications")
                .select("id", { count: "exact", head: true })
                .eq("applied_date", today),
            ),
            countOrZero(
              supabase
                .from("job_applications")
                .select("id", { count: "exact", head: true })
                .gte("applied_date", week.start)
                .lte("applied_date", week.end),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .in("stage", ["screening", "technical", "panel", "hr"]),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .eq("stage", "offer"),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .eq("stage", "assessment"),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .eq("stage", "screening"),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .eq("stage", "technical"),
            ),
            countOrZero(
              supabase
                .from("placement_pipeline_events")
                .select("id", { count: "exact", head: true })
                .eq("stage", "panel"),
            ),
            supabase
              .from("job_applications")
              .select("id, student_id, company_name, job_role, status, applied_at, applied_date")
              .order("applied_at", { ascending: false })
              .limit(8),
            supabase.from("job_applications").select("student_id").eq("applied_date", today),
          ]);

        const employees = employeesRes.rows;
        const students = studentsRes.rows;
        const migrationPending = employeesRes.migrationPending || studentsRes.migrationPending;

        const activeEmployees = employees.filter((e) => e.status !== "inactive");
        const inactiveEmployees = employees.filter((e) => e.status === "inactive");

        let assigned = 0;
        let unassigned = 0;
        let inactiveStudents = 0;
        for (const s of students) {
          const bucket = getStudentBucket(s);
          if (bucket === "inactive") inactiveStudents += 1;
          else if (bucket === "assigned") assigned += 1;
          else unassigned += 1;
        }

        const trials = trialsRes.error ? [] : (trialsRes.data ?? []);
        if (trialsRes.error) console.warn("trial_students query failed:", trialsRes.error);

        const activeTrials = trials.filter((t) =>
          ["new", "assigned", "active"].includes(t.trial_status),
        );
        const expiringSoon = activeTrials.filter(
          (t) => t.trial_end_date && t.trial_end_date >= today && t.trial_end_date <= soon,
        );

        const todayApps = todayAppsRes.error ? [] : (todayAppsRes.data ?? []);
        if (todayAppsRes.error) console.warn("today apps query failed:", todayAppsRes.error);

        const appsByStudent: Record<string, number> = {};
        for (const row of todayApps) {
          appsByStudent[row.student_id] = (appsByStudent[row.student_id] ?? 0) + 1;
        }

        const studentsByEmployee: Record<string, Student[]> = {};
        for (const s of students) {
          if (!s.assigned_to || s.status === "inactive") continue;
          if (!studentsByEmployee[s.assigned_to]) studentsByEmployee[s.assigned_to] = [];
          studentsByEmployee[s.assigned_to].push(s);
        }

        const employeePerformance: EmployeePerformanceRow[] = activeEmployees
          .map((emp) => {
            const assignedList = studentsByEmployee[emp.id] ?? [];
            const appsTodayCount = assignedList.reduce(
              (sum, s) => sum + (appsByStudent[s.id] ?? 0),
              0,
            );
            const dailyTarget = employeeEffectiveDailyTarget(emp, assignedList.length);
            const progressPct =
              dailyTarget > 0 ? Math.round((appsTodayCount / dailyTarget) * 100) : 0;
            return {
              employeeId: emp.id,
              name: emp.name,
              status: emp.status,
              assignedStudents: assignedList.length,
              appsToday: appsTodayCount,
              dailyTarget,
              progressPct,
            };
          })
          .sort((a, b) => b.appsToday - a.appsToday);

        const studentNameById = Object.fromEntries(students.map((s) => [s.id, s.name]));
        const recentRows = recentAppsRes.error ? [] : (recentAppsRes.data ?? []);
        if (recentAppsRes.error) console.warn("recent apps query failed:", recentAppsRes.error);

        const recentActivity: RecentActivityItem[] = recentRows.map((app) => ({
          id: app.id,
          studentId: app.student_id,
          studentName: studentNameById[app.student_id] ?? "Unknown student",
          company: app.company_name,
          role: app.job_role,
          status: app.status,
          appliedAt: app.applied_at,
          appliedDate: app.applied_date,
        }));

        const alerts: DashboardAlert[] = [];
        if (migrationPending) {
          alerts.push({
            id: "migration",
            tone: "info",
            title: "Database migration pending",
            detail:
              "New columns (daily_target, payment_status, …) are not in production yet. Progress uses default target 40 until you apply the Phase 4 SQL.",
          });
        }
        if (unassigned > 0) {
          alerts.push({
            id: "unassigned",
            tone: "warning",
            title: `${unassigned} unassigned student${unassigned === 1 ? "" : "s"}`,
            detail: "Assign a counselor so applications can be tracked against targets.",
          });
        }
        if (expiringSoon.length > 0) {
          alerts.push({
            id: "trials",
            tone: "warning",
            title: `${expiringSoon.length} free trial${expiringSoon.length === 1 ? "" : "s"} ending within 3 days`,
            detail: expiringSoon
              .map((t) => t.full_name)
              .slice(0, 5)
              .join(", "),
          });
        }
        const lowProgress = employeePerformance.filter(
          (e) => e.assignedStudents > 0 && e.progressPct < 40,
        );
        if (lowProgress.length > 0) {
          alerts.push({
            id: "low-progress",
            tone: "danger",
            title: `${lowProgress.length} employee${lowProgress.length === 1 ? "" : "s"} under 40% of daily target`,
            detail: lowProgress
              .slice(0, 4)
              .map((e) => `${e.name} (${e.appsToday}/${e.dailyTarget})`)
              .join(" · "),
          });
        }

        return {
          migrationPending,
          employees: {
            total: employees.length,
            active: activeEmployees.length,
            inactive: inactiveEmployees.length,
          },
          students: {
            total: students.length,
            active: assigned,
            inactive: inactiveStudents,
            assigned,
            unassigned,
          },
          freeTrials: {
            total: trials.length,
            active: activeTrials.length,
            expiringSoon: expiringSoon.length,
          },
          applications: {
            today: appsToday,
            week: appsWeek,
          },
          interviews,
          placements,
          pipeline: {
            assessment: assessmentCount,
            screening: screeningCount,
            technical: technicalCount,
            panel: panelCount,
          },
          studentStatusSummary: {
            assigned,
            unassigned,
            inactive: inactiveStudents,
          },
          employeePerformance,
          recentActivity,
          alerts,
        };
      } catch (err) {
        throw toError(err, "Could not load dashboard");
      }
    },
    refetchInterval: 60_000,
  });
}
