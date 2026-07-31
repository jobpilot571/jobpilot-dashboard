import type { JobApplication } from "@/hooks/useJobApplications";

export type HistoryBucket = "daily" | "weekly" | "monthly" | "yearly";

export interface HistoryGroup {
  key: string;
  label: string;
  count: number;
  apps: JobApplication[];
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseAppDate(app: JobApplication): Date {
  const raw = app.applied_date || app.applied_at || app.created_at;
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function formatDailyLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatWeekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const a = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
  const b = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
  return `Week of ${a} – ${b}`;
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Chicago" });
}

function formatYearLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", timeZone: "America/Chicago" });
}

/** Group past applications (excluding today) for Daily/Weekly/Monthly/Yearly history. */
export function groupAppHistory(
  apps: JobApplication[],
  bucket: HistoryBucket,
  todayYmd: string,
): HistoryGroup[] {
  const past = apps.filter((a) => (a.applied_date || "") !== todayYmd);
  const map = new Map<string, HistoryGroup>();

  for (const app of past) {
    const d = parseAppDate(app);
    let key: string;
    let label: string;
    if (bucket === "daily") {
      key = app.applied_date || d.toISOString().slice(0, 10);
      label = formatDailyLabel(d);
    } else if (bucket === "weekly") {
      const mon = mondayOf(d);
      key = mon.toISOString().slice(0, 10);
      label = formatWeekLabel(mon);
    } else if (bucket === "monthly") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = formatMonthLabel(d);
    } else {
      key = String(d.getFullYear());
      label = formatYearLabel(d);
    }

    const existing = map.get(key);
    if (existing) {
      existing.apps.push(app);
      existing.count += 1;
    } else {
      map.set(key, { key, label, count: 1, apps: [app] });
    }
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}
