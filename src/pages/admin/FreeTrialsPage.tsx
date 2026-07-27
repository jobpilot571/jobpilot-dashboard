import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ExternalLink,
  Pencil,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/dialog";
import { TrialEditDialog } from "@/components/trials/TrialEditDialog";
import { useEmployees } from "@/hooks/useEmployees";
import { useAllTrialStudents, useTrialAppCounts, type TrialStudent } from "@/hooks/useTrialStudents";
import { supabase } from "@/integrations/supabase/client";
import { getTodayCST } from "@/lib/timezone";
import {
  TRIAL_PAGE_SIZE,
  TRIAL_STATUSES,
  daysUntil,
  parseFollowUp,
  type TrialStatus,
} from "@/features/trials/constants";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | TrialStatus | "expiring";

export default function AdminFreeTrialsPage() {
  const queryClient = useQueryClient();
  const { data: trials = [], isLoading, isError, error, refetch } = useAllTrialStudents();
  const { data: employees = [] } = useEmployees();
  const { data: appCounts = {} } = useTrialAppCounts(trials.map((t) => t.email));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [empFilter, setEmpFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TrialStudent | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = getTodayCST();
  const empName = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.name])), [employees]);

  const expiringSoon = useMemo(
    () =>
      trials.filter((t) => {
        if (["converted", "expired"].includes(t.trial_status)) return false;
        const d = daysUntil(t.trial_end_date, today);
        return d >= 0 && d <= 3;
      }),
    [trials, today],
  );

  const overdueUnmarked = useMemo(
    () =>
      trials.filter((t) => {
        if (["converted", "expired"].includes(t.trial_status)) return false;
        return daysUntil(t.trial_end_date, today) < 0;
      }),
    [trials, today],
  );

  const counts = useMemo(() => {
    return {
      total: trials.length,
      new: trials.filter((t) => t.trial_status === "new").length,
      active: trials.filter((t) => t.trial_status === "assigned" || t.trial_status === "active").length,
      converted: trials.filter((t) => t.trial_status === "converted").length,
      expiring: expiringSoon.length,
    };
  }, [trials, expiringSoon]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trials.filter((t) => {
      if (statusFilter === "expiring") {
        const d = daysUntil(t.trial_end_date, today);
        if (["converted", "expired"].includes(t.trial_status) || d < 0 || d > 3) return false;
      } else if (statusFilter === "active") {
        if (t.trial_status !== "active" && t.trial_status !== "assigned") return false;
      } else if (statusFilter !== "all" && t.trial_status !== statusFilter) {
        return false;
      }

      if (empFilter === "unassigned" && t.assigned_to) return false;
      if (empFilter !== "all" && empFilter !== "unassigned" && t.assigned_to !== empFilter) return false;

      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.target_role || "").toLowerCase().includes(q) ||
        (t.assigned_to ? (empName[t.assigned_to] || "").toLowerCase().includes(q) : false)
      );
    });
  }, [trials, search, statusFilter, empFilter, today, empName]);

  const pageCount = Math.max(1, Math.ceil(rows.length / TRIAL_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * TRIAL_PAGE_SIZE, page * TRIAL_PAGE_SIZE);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["trial-students"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const updateAssignment = async (id: string, employeeId: string) => {
    setBusyId(id);
    try {
      const value = employeeId === "unassigned" ? null : employeeId;
      const trial = trials.find((t) => t.id === id);
      const { error } = await supabase
        .from("trial_students")
        .update({
          assigned_to: value,
          assigned_at: value ? new Date().toISOString() : null,
          trial_status:
            value && trial && trial.trial_status === "new" ? "assigned" : trial?.trial_status ?? "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(value ? "Assigned." : "Unassigned.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign.");
    } finally {
      setBusyId(null);
    }
  };

  const updateStatus = async (id: string, status: TrialStatus) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("trial_students")
        .update({ trial_status: status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Status updated.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  };

  const markExpiredBatch = async () => {
    if (overdueUnmarked.length === 0) return;
    try {
      const ids = overdueUnmarked.map((t) => t.id);
      const { error } = await supabase
        .from("trial_students")
        .update({ trial_status: "expired", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Marked ${ids.length} trial(s) as expired.`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark expired.");
    }
  };

  const activeEmployees = employees.filter((e) => e.status !== "inactive");

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Free Trials
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track signups, assignments, apps completed, expiry, and conversion. Chat is deferred.
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total trials" value={counts.total} icon={Sparkles} />
          <StatCard label="New" value={counts.new} icon={Sparkles} tone="info" />
          <StatCard label="Active / assigned" value={counts.active} icon={Sparkles} tone="success" />
          <StatCard
            label="Expiring ≤3 days"
            value={counts.expiring}
            icon={AlertTriangle}
            tone={counts.expiring > 0 ? "warning" : "default"}
          />
          <StatCard label="Converted" value={counts.converted} icon={Sparkles} tone="success" />
        </section>

        {(expiringSoon.length > 0 || overdueUnmarked.length > 0) && (
          <div className="space-y-2">
            {expiringSoon.length > 0 ? (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-foreground">
                    {expiringSoon.length} trial{expiringSoon.length === 1 ? "" : "s"} ending within 3 days
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {expiringSoon
                      .slice(0, 6)
                      .map((t) => `${t.full_name} (${daysUntil(t.trial_end_date, today)}d)`)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ) : null}
            {overdueUnmarked.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-foreground">
                      {overdueUnmarked.length} trial{overdueUnmarked.length === 1 ? "" : "s"} past end date
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Still marked active/new/assigned.</p>
                  </div>
                </div>
                <Button type="button" size="sm" variant="destructive" onClick={() => void markExpiredBatch()}>
                  Mark all expired
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, role, employee…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              className="h-10 max-w-xs"
              value={empFilter}
              onChange={(e) => {
                setEmpFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All employees</option>
              <option value="unassigned">Unassigned</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", `All (${counts.total})`],
                ["new", `New (${counts.new})`],
                ["active", `Active (${counts.active})`],
                ["expiring", `Expiring (${counts.expiring})`],
                ["converted", `Converted (${counts.converted})`],
                ["expired", "Expired"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === key
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Could not load trials</p>
            <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Student</th>
                  <th className="px-3 py-3 font-medium">Target role</th>
                  <th className="px-3 py-3 font-medium">Trial window</th>
                  <th className="px-3 py-3 font-medium">Apps</th>
                  <th className="px-3 py-3 font-medium">Assigned to</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Follow-up</th>
                  <th className="px-3 py-3 font-medium">Resume</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-3 py-3" colSpan={9}>
                          <Skeleton className="h-10 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!isLoading && pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                      No trials match your filters.
                    </td>
                  </tr>
                ) : null}
                {pageRows.map((t) => {
                  const days = daysUntil(t.trial_end_date, today);
                  const apps = appCounts[t.email.toLowerCase()] ?? 0;
                  const follow = parseFollowUp(t.notes).followUp;
                  const endingSoon = !["converted", "expired"].includes(t.trial_status) && days >= 0 && days <= 3;
                  const pastDue = !["converted", "expired"].includes(t.trial_status) && days < 0;

                  return (
                    <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">{t.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                        <p className="text-[11px] text-muted-foreground">{t.phone || "No phone"} · {t.visa_status || "Visa n/a"}</p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{t.target_role || "—"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        <div>{format(new Date(t.signup_date), "MMM d, yyyy")}</div>
                        <div className="mt-0.5">→ {format(new Date(t.trial_end_date), "MMM d, yyyy")}</div>
                        {endingSoon ? (
                          <Badge className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-700">
                            {days === 0 ? "Ends today" : `${days}d left`}
                          </Badge>
                        ) : null}
                        {pastDue ? (
                          <Badge className="mt-1 border-destructive/30 bg-destructive/10 text-destructive">
                            Overdue {Math.abs(days)}d
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                          {apps}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          className="h-8 text-xs"
                          value={t.assigned_to ?? "unassigned"}
                          disabled={busyId === t.id}
                          onChange={(e) => void updateAssignment(t.id, e.target.value)}
                        >
                          <option value="unassigned">Unassigned</option>
                          {activeEmployees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          className={cn("h-8 text-xs", statusClass(t.trial_status))}
                          value={t.trial_status}
                          disabled={busyId === t.id}
                          onChange={(e) => void updateStatus(t.id, e.target.value as TrialStatus)}
                        >
                          {TRIAL_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3 capitalize text-muted-foreground">
                        {follow.replace("_", " ")}
                      </td>
                      <td className="px-3 py-3">
                        {t.resume_url ? (
                          <a
                            href={t.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(t)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {rows.length === 0 ? 0 : (page - 1) * TRIAL_PAGE_SIZE + 1}–
              {Math.min(page * TRIAL_PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <TrialEditDialog
        open={!!editing}
        trial={editing}
        employees={employees}
        onClose={() => setEditing(null)}
      />
    </AppShell>
  );
}

function statusClass(status: TrialStatus): string {
  switch (status) {
    case "new":
      return "border-primary/30 bg-primary/5 text-primary";
    case "assigned":
    case "active":
      return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700";
    case "expired":
      return "border-destructive/30 bg-destructive/5 text-destructive";
    case "converted":
      return "border-border bg-muted text-foreground";
    default:
      return "";
  }
}
