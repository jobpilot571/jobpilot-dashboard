import { DEFAULT_DAILY_TARGET } from "@/lib/constants";

export type EmployeeStatus = "active" | "pending" | "inactive" | string;

export interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  job_role_category: string;
  avatar: string;
  status: EmployeeStatus;
  created_at: string;
  daily_target?: number | null;
  joining_date?: string | null;
  last_active_at?: string | null;
  /** Employee can see/work on every student without becoming admin. */
  can_access_all_students?: boolean | null;
  /** Team lead: all students + manage all employees (still not full admin). */
  is_team_lead?: boolean | null;
}

/** Per-student daily application target (DB column or default 40). */
export function employeeDailyTarget(employee: Pick<Employee, "daily_target">): number {
  return employee.daily_target && employee.daily_target > 0
    ? employee.daily_target
    : DEFAULT_DAILY_TARGET;
}

/**
 * Effective daily target for an employee = assigned active students × per-student target.
 * Example: 3 students × 40 = 120.
 */
export function employeeEffectiveDailyTarget(
  employee: Pick<Employee, "daily_target">,
  assignedStudentCount: number,
): number {
  const perStudent = employeeDailyTarget(employee);
  const n = Math.max(0, assignedStudentCount);
  return n * perStudent;
}


/** Prefer this list; falls back if optional target/activity columns are missing. */
export const EMPLOYEE_SELECT_FULL =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at, daily_target, joining_date, last_active_at, can_access_all_students, is_team_lead";
/** Always includes Team Lead / all-students flags (must not be dropped on fallback). */
export const EMPLOYEE_SELECT_WITH_FLAGS =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at, can_access_all_students, is_team_lead";
export const EMPLOYEE_SELECT_MIN =
  "id, user_id, name, email, role, job_role_category, avatar, status, created_at";

type PostgrestLikeError = { message?: string; code?: string } | null;

/**
 * Retry an employees select without optional columns, but keep access flags
 * unless those columns themselves are missing.
 */
export async function withEmployeeSelectFallback<T>(
  run: (columns: string) => Promise<{ data: T | null; error: PostgrestLikeError }>,
): Promise<T> {
  const attempts = [EMPLOYEE_SELECT_FULL, EMPLOYEE_SELECT_WITH_FLAGS, EMPLOYEE_SELECT_MIN];
  let lastError: PostgrestLikeError = null;
  for (const columns of attempts) {
    const res = await run(columns);
    if (!res.error) return res.data as T;
    lastError = res.error;
    if (!isMissingColumnError(res.error)) throw res.error;
  }
  throw lastError ?? new Error("Failed to load employees");
}

/** True when PostgREST reports a missing column (migration not applied yet). */
export function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("daily_target") ||
    msg.includes("payment_status") ||
    msg.includes("payment_amount") ||
    msg.includes("joining_date") ||
    msg.includes("next_pay_date") ||
    msg.includes("payment_reminder_sent_on") ||
    msg.includes("last_active_at") ||
    msg.includes("can_access_all_students") ||
    msg.includes("is_team_lead") ||
    error.code === "42703" // undefined_column
  );
}

/** True when the employee can see/work on every student. */
export function employeeSeesAllStudents(employee: Pick<Employee, "can_access_all_students" | "is_team_lead"> | null | undefined): boolean {
  return !!(employee?.can_access_all_students || employee?.is_team_lead);
}

/** True when the employee can manage all employees (Team Lead). */
export function employeeIsTeamLead(employee: Pick<Employee, "is_team_lead"> | null | undefined): boolean {
  return !!employee?.is_team_lead;
}

export function employeeStartDate(
  employee: Pick<Employee, "joining_date" | "created_at">,
): string | null {
  return employee.joining_date || employee.created_at || null;
}
