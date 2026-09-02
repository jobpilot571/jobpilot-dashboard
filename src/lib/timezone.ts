/**
 * Shared timezone utility for America/Chicago (CST/CDT).
 * All business-day logic and daily counts use this timezone.
 */

export const BUSINESS_TZ = "America/Chicago";

/** Current date in America/Chicago as YYYY-MM-DD. */
export function getTodayCST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(now);
}

/** Current time in America/Chicago as hh:mm AM/PM. */
export function getNowTimeCST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}

export function getNowCST(now = new Date()): { date: string; time: string } {
  return { date: getTodayCST(now), time: getNowTimeCST(now) };
}

export function formatDateCST(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date(isoTimestamp));
}

/** Display a timestamp as "Aug 5, 2026, 3:14 PM" in America/Chicago. */
export function formatDateTimeCST(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

/** Display a date-only (YYYY-MM-DD) or ISO timestamp as "Aug 5, 2026" without TZ shift. */
export function formatRosterDate(value?: string | null): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(y, m - 1, d));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatTimeCST(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoTimestamp));
}

/** Monday–Sunday week containing `now`, as CST calendar dates. */
export function getWeekRangeCST(now = new Date()): { start: string; end: string } {
  const today = getTodayCST(now);
  // Parse as local noon to avoid DST edge issues when computing weekday
  const [y, m, d] = today.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0)); // ~CST noon UTC-ish; weekday via formatter
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
  }).format(probe);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday] ?? 0;
  const daysFromMonday = (dow + 6) % 7; // Mon=0 … Sun=6

  const startDate = new Date(Date.UTC(y, m - 1, d - daysFromMonday));
  const endDate = new Date(Date.UTC(y, m - 1, d - daysFromMonday + 6));

  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

  return { start: fmt(startDate), end: fmt(endDate) };
}
