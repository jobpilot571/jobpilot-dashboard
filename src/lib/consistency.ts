/**
 * Employee consistency tracking — shared logic.
 * Goal: detect consistent active work (~7h) vs burst submissions.
 */

import { BUSINESS_TZ, formatTimeCST } from "@/lib/timezone";

export const REQUIRED_ACTIVE_HOURS = 7;
export const PARTIAL_MIN_HOURS = 5;
export const MAX_BREAK_MIN = 60;
export const SLOW_GAP_MIN = 15;
export const INACTIVE_GAP_MIN = 20;
export const INACTIVITY_ALERT_MIN = 20;

export interface MiniApp {
  applied_at: string;
  student_id?: string | null;
}

export interface ConsistencyStats {
  employeeId: string;
  employeeName: string;
  totalApplications: number;
  startTime: string | null;
  lastApplicationTime: string | null;
  startTimeLabel: string;
  lastApplicationLabel: string;
  activeMinutes: number;
  breakUsedMinutes: number;
  inactiveMinutes: number;
  slowGaps: number;
  inactiveGaps: number;
  appsPerHour: Record<number, number>;
  status: "completed" | "in_progress" | "below_required" | "no_activity";
  inactiveNow: boolean;
  minutesSinceLastApp: number | null;
}

export function cstHourOf(iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parseInt(h, 10) % 24;
}

export function computeConsistency(
  employeeId: string,
  employeeName: string,
  apps: MiniApp[],
  now: Date = new Date(),
): ConsistencyStats {
  const sorted = [...apps]
    .filter((a) => a.applied_at)
    .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());

  const total = sorted.length;
  const empty: ConsistencyStats = {
    employeeId,
    employeeName,
    totalApplications: 0,
    startTime: null,
    lastApplicationTime: null,
    startTimeLabel: "—",
    lastApplicationLabel: "—",
    activeMinutes: 0,
    breakUsedMinutes: 0,
    inactiveMinutes: 0,
    slowGaps: 0,
    inactiveGaps: 0,
    appsPerHour: {},
    status: "no_activity",
    inactiveNow: false,
    minutesSinceLastApp: null,
  };
  if (total === 0) return empty;

  const startIso = sorted[0].applied_at;
  const endIso = sorted[total - 1].applied_at;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const appsPerHour: Record<number, number> = {};
  for (const a of sorted) {
    const h = cstHourOf(a.applied_at);
    appsPerHour[h] = (appsPerHour[h] ?? 0) + 1;
  }

  let slowGaps = 0;
  const inactiveGapMins: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (new Date(sorted[i].applied_at).getTime() - new Date(sorted[i - 1].applied_at).getTime()) /
      60000;
    if (gap > INACTIVE_GAP_MIN) inactiveGapMins.push(gap);
    else if (gap > SLOW_GAP_MIN) slowGaps++;
  }

  const sortedGapsDesc = [...inactiveGapMins].sort((a, b) => b - a);
  let breakRemaining = MAX_BREAK_MIN;
  let breakUsed = 0;
  let inactiveTotal = 0;
  for (const g of sortedGapsDesc) {
    if (breakRemaining > 0) {
      const absorb = Math.min(g, breakRemaining);
      breakUsed += absorb;
      breakRemaining -= absorb;
      inactiveTotal += g - absorb;
    } else {
      inactiveTotal += g;
    }
  }

  const shiftMin = Math.max(0, (endMs - startMs) / 60000);
  const activeMin = Math.max(0, shiftMin - breakUsed - inactiveTotal);
  const activeHours = activeMin / 60;

  const status: ConsistencyStats["status"] =
    activeHours >= REQUIRED_ACTIVE_HOURS
      ? "completed"
      : activeHours >= PARTIAL_MIN_HOURS
        ? "in_progress"
        : "below_required";

  const minutesSinceLastApp = (now.getTime() - endMs) / 60000;

  return {
    employeeId,
    employeeName,
    totalApplications: total,
    startTime: startIso,
    lastApplicationTime: endIso,
    startTimeLabel: formatTimeCST(startIso),
    lastApplicationLabel: formatTimeCST(endIso),
    activeMinutes: Math.round(activeMin),
    breakUsedMinutes: Math.round(breakUsed),
    inactiveMinutes: Math.round(inactiveTotal),
    slowGaps,
    inactiveGaps: inactiveGapMins.length,
    appsPerHour,
    status,
    inactiveNow: minutesSinceLastApp > INACTIVITY_ALERT_MIN,
    minutesSinceLastApp: Math.round(minutesSinceLastApp),
  };
}

export function formatHoursMinutes(totalMin: number): string {
  if (!totalMin || totalMin <= 0) return "0h 00m";
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function statusLabel(s: ConsistencyStats["status"]): string {
  switch (s) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "below_required":
      return "Below Required";
    default:
      return "No Activity";
  }
}
