import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { AppStatusBadge } from "@/components/applications/AppStatusBadge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useJobApplications, APP_STATUSES } from "@/hooks/useJobApplications";
import { formatTimeCST, getTodayCST } from "@/lib/timezone";

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default function StudentHistoryPage() {
  const { user } = useAuth();
  const today = getTodayCST();
  const [dateFrom, setDateFrom] = useState(addDays(today, -89));
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: student, isLoading: stuLoading } = useCurrentStudent();
  const { data: apps = [], isLoading } = useJobApplications(student?.id);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (a.applied_date < dateFrom || a.applied_date > dateTo) return false;
      if (status !== "all" && a.status !== status) return false;
      if (!q) return true;
      return (
        a.company_name.toLowerCase().includes(q) ||
        a.job_role.toLowerCase().includes(q) ||
        a.applied_link.toLowerCase().includes(q)
      );
    });
  }, [apps, dateFrom, dateTo, status, search]);

  if (!stuLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  return (
    <AppShell role="student">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Applications submitted for you by your coordinator.
          </p>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {APP_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Search</span>
            <Input
              placeholder="Company or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Company / Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || stuLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-3">
                        <Skeleton className="h-7 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((a) => (
                    <tr key={a.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="tabular-nums">{a.applied_date}</div>
                        <div className="text-xs">{formatTimeCST(a.applied_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.company_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{a.job_role || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <AppStatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3">
                        {a.applied_link ? (
                          <a
                            href={a.applied_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No applications match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Showing {rows.length} of {apps.length} applications.</p>
      </div>
    </AppShell>
  );
}
