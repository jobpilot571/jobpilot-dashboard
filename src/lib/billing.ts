import { getTodayCST } from "@/lib/timezone";
import type { Student } from "@/lib/students";

export const PAYMENT_REMINDER_DAYS_BEFORE = 5;

export type LivePaymentStatus = "paid" | "unpaid" | "waived" | "n/a";

function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function formatDateOnly(y: number, m: number, d: number): string {
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, d), last);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Calendar month + N, clamping the day (Jan 31 → Feb 28). */
export function addMonthsDateOnly(iso: string, months: number): string {
  const p = parts(iso);
  if (!p) return iso;
  const idx = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return formatDateOnly(y, m, p.d);
}

export function billingDayFromStart(startDate?: string | null): number {
  return parts(startDate || "")?.d ?? 1;
}

/** One month after this cycle’s due day (start-date day in the paid month). */
export function nextPayDateAfter(paidDate: string, startDate?: string | null): string {
  const paid = parts(paidDate);
  if (!paid) return addMonthsDateOnly(paidDate, 1);
  const day = billingDayFromStart(startDate || paidDate);
  const thisCycleDue = formatDateOnly(paid.y, paid.m, day);
  return addMonthsDateOnly(thisCycleDue, 1);
}

export function daysUntilDate(target: string, today = getTodayCST()): number {
  const a = parts(today);
  const b = parts(target);
  if (!a || !b) return Number.NaN;
  const ms =
    Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86_400_000);
}

/**
 * Paid until the next pay date; on that date (and after) it becomes unpaid.
 * waived / n/a stay as stored overrides.
 */
export function livePaymentStatus(
  student: Pick<Student, "payment_status" | "next_pay_date" | "payment_date" | "joining_date">,
  today = getTodayCST(),
): LivePaymentStatus {
  const stored = (student.payment_status || "").toLowerCase();
  if (stored === "waived" || stored === "n/a") return stored;

  const next = student.next_pay_date || null;
  if (student.payment_date && next && today < next) return "paid";
  return "unpaid";
}

export function shouldSendPaymentReminder(
  nextPayDate: string | null | undefined,
  today = getTodayCST(),
): boolean {
  if (!nextPayDate) return false;
  const days = daysUntilDate(nextPayDate, today);
  return days >= 1 && days <= PAYMENT_REMINDER_DAYS_BEFORE;
}

export function defaultNextPayDate(startDate?: string | null): string | null {
  return startDate || null;
}
