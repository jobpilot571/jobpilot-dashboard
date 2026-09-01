export type StudentAccountStatus = "active" | "pending" | "completed" | "on-hold" | "inactive" | string;

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  program: string;
  status: StudentAccountStatus;
  assigned_to: string | null;
  last_assigned_to: string | null;
  inactive_at: string | null;
  inactive_reason: string | null;
  user_id: string | null;
  applied_date: string;
  documents_submitted: number;
  documents_total: number;
  created_at: string;
  joining_date?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  payment_notes?: string | null;
  next_pay_date?: string | null;
  payment_reminder_sent_on?: string | null;
  last_active_at?: string | null;
  profile_json?: unknown;
}

/** Operational bucket used by dashboards (not raw DB status alone). */
export type StudentBucket = "inactive" | "assigned" | "unassigned";

export function getStudentBucket(student: Pick<Student, "status" | "assigned_to">): StudentBucket {
  if (student.status === "inactive") return "inactive";
  if (student.assigned_to) return "assigned";
  return "unassigned";
}

export function studentStartDate(
  student: Pick<Student, "joining_date" | "applied_date" | "created_at">,
): string | null {
  return student.joining_date || student.applied_date || student.created_at || null;
}
