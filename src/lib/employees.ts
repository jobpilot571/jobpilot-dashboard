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
    msg.includes("last_active_at") ||
    msg.includes("can_access_all_students") ||
    error.code === "42703" // undefined_column
  );
}
