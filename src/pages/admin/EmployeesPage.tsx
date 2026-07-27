import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { EmployeeDetailPanel } from "@/components/employees/EmployeeDetailPanel";
import { EmailStatusBadge } from "@/components/employees/EmailStatusBadge";
import { useEmployees } from "@/hooks/useEmployees";
import { useStudents } from "@/hooks/useStudents";
import { useWelcomeEmailLogs } from "@/hooks/useEmailLogs";
import { useEmployeeAppsToday } from "@/hooks/useEmployeeAppsToday";
import { employeeEffectiveDailyTarget, type Employee } from "@/lib/employees";
import { sendWelcomeCredentials } from "@/lib/sendWelcomeCredentials";
import { supabase } from "@/integrations/supabase/client";
import {
  PAGE_SIZE,
  getInitials,
  type EmployeeSortKey,
  type EmployeeStatusFilter,
} from "@/features/employees/constants";
import { cn } from "@/lib/utils";

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading, isError, error, refetch } = useEmployees();
  const { data: students = [] } = useStudents();
  const { data: appsTodayData } = useEmployeeAppsToday();
  const appsMap = appsTodayData?.byEmployee ?? {};
  const appsByStudent = appsTodayData?.byStudent ?? {};
  const emailLogs = useWelcomeEmailLogs(employees.map((e) => e.user_id));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatusFilter>("active");
  const [sortKey, setSortKey] = useState<EmployeeSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [confirmToggle, setConfirmToggle] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const active = employees.filter((e) => e.status !== "inactive").length;
    const inactive = employees.length - active;
    return { all: employees.length, active, inactive };
  }, [employees]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = employees.filter((e) => {
      if (statusFilter === "active" && e.status === "inactive") return false;
      if (statusFilter === "inactive" && e.status !== "inactive") return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.job_role_category || "").toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      const aApps = appsMap[a.id]?.appsToday ?? 0;
      const bApps = appsMap[b.id]?.appsToday ?? 0;
      const aAssigned = appsMap[a.id]?.assigned ?? students.filter((s) => s.assigned_to === a.id && s.status !== "inactive").length;
      const bAssigned = appsMap[b.id]?.assigned ?? students.filter((s) => s.assigned_to === b.id && s.status !== "inactive").length;
      const aTarget = employeeEffectiveDailyTarget(a, aAssigned);
      const bTarget = employeeEffectiveDailyTarget(b, bAssigned);
      const aProg = aTarget > 0 ? aApps / aTarget : 0;
      const bProg = bTarget > 0 ? bApps / bTarget : 0;

      let cmp = 0;
      switch (sortKey) {
        case "category":
          cmp = (a.job_role_category || "").localeCompare(b.job_role_category || "");
          break;
        case "appsToday":
          cmp = aApps - bApps;
          break;
        case "progress":
          cmp = aProg - bProg;
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "assigned":
          cmp = aAssigned - bAssigned;
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [employees, students, appsMap, search, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: EmployeeSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "category" || key === "status" ? "asc" : "desc");
    }
  };

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["employees"] });
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["email_logs"] });
    void queryClient.invalidateQueries({ queryKey: ["employee-apps-today"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const setStatus = async (emp: Employee, status: "active" | "inactive") => {
    setBusy(true);
    try {
      const { error } = await supabase.from("employees").update({ status }).eq("id", emp.id);
      if (error) throw error;
      toast.success(status === "inactive" ? "Employee deactivated." : "Employee activated.");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
      setConfirmToggle(null);
    }
  };

  const resendWelcome = async (emp: Employee) => {
    if (!emp.user_id) {
      toast.error("This employee has no login yet. Create a login first.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendWelcomeCredentials({
        user_id: emp.user_id,
        email: emp.email,
        name: emp.name,
        role: "employee",
        is_resend: true,
        reset_password: true,
      });
      if (!res.success) throw new Error(res.error || "Failed to send.");
      toast.success("Welcome / credentials email sent.");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  };

  const resetPw = async () => {
    if (!resetTarget?.user_id) return;
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-employee", {
        body: {
          action: "reset_password",
          user_id: resetTarget.user_id,
          new_password: resetPassword,
        },
      });
      if (error) {
        const msg =
          (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) ||
          error.message;
        throw new Error(msg);
      }
      if (data && typeof data === "object" && "error" in data && (data as { error: unknown }).error) {
        throw new Error(String((data as { error: unknown }).error));
      }

      const emailRes = await sendWelcomeCredentials({
        user_id: resetTarget.user_id,
        email: resetTarget.email,
        name: resetTarget.name,
        role: "employee",
        password: resetPassword,
        reset_password: true,
      });
      if (emailRes.success) toast.success("Password reset and email sent.");
      else toast.warning("Password reset, but email failed.");
      setResetTarget(null);
      setResetPassword("");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Employees</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage counselors, daily targets, assignments, and credentials.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email, category…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", `All (${counts.all})`],
                ["active", `Active (${counts.active})`],
                ["inactive", `Inactive (${counts.inactive})`],
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
            <p className="font-medium text-destructive">Could not load employees</p>
            <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th label="Employee" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
                  <Th label="Category" onClick={() => toggleSort("category")} active={sortKey === "category"} dir={sortDir} />
                  <Th label="Assigned" onClick={() => toggleSort("assigned")} active={sortKey === "assigned"} dir={sortDir} />
                  <Th label="Apps today" onClick={() => toggleSort("appsToday")} active={sortKey === "appsToday"} dir={sortDir} />
                  <Th label="Progress" onClick={() => toggleSort("progress")} active={sortKey === "progress"} dir={sortDir} />
                  <Th label="Status" onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir} />
                  <th className="px-3 py-3 font-medium">Welcome email</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-3 py-3" colSpan={8}>
                          <Skeleton className="h-10 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!isLoading && pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      No employees match your filters.
                    </td>
                  </tr>
                ) : null}
                {pageRows.map((emp) => {
                  const stats = appsMap[emp.id] ?? {
                    assigned: students.filter((s) => s.assigned_to === emp.id && s.status !== "inactive").length,
                    appsToday: 0,
                  };
                  const target = employeeEffectiveDailyTarget(emp, stats.assigned);
                  const progress = target > 0 ? Math.round((stats.appsToday / target) * 100) : 0;
                  const log = emp.user_id ? emailLogs.data?.[emp.user_id] : null;

                  return (
                    <tr key={emp.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-3 text-left"
                          onClick={() => setDetail(emp)}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {emp.avatar || getInitials(emp.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{emp.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{emp.job_role_category || "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">
                        {stats.assigned} student{stats.assigned === 1 ? "" : "s"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                          {stats.appsToday}
                        </span>
                      </td>
                      <td className="min-w-[150px] px-3 py-3">
                        <div className="space-y-1">
                          <ProgressBar value={progress} />
                          <p className="text-[11px] text-muted-foreground">Target {target}/day</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          className={
                            emp.status === "inactive"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          }
                        >
                          {emp.status === "inactive" ? (
                            <>
                              <UserX className="h-3 w-3" /> Inactive
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" /> Active
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <EmailStatusBadge log={log} />
                      </td>
                      <td className="relative px-3 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setMenuId((id) => (id === emp.id ? null : emp.id))}
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {menuId === emp.id ? (
                          <div className="absolute right-3 z-20 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-lg">
                            <MenuItem
                              icon={UserCheck}
                              label="View details"
                              onClick={() => {
                                setDetail(emp);
                                setMenuId(null);
                              }}
                            />
                            <MenuItem
                              icon={Pencil}
                              label="Edit"
                              onClick={() => {
                                setEditing(emp);
                                setFormOpen(true);
                                setMenuId(null);
                              }}
                            />
                            <MenuItem
                              icon={emp.status === "inactive" ? UserCheck : UserX}
                              label={emp.status === "inactive" ? "Activate" : "Deactivate"}
                              onClick={() => {
                                setConfirmToggle(emp);
                                setMenuId(null);
                              }}
                            />
                            <MenuItem
                              icon={KeyRound}
                              label="Reset password"
                              disabled={!emp.user_id}
                              onClick={() => {
                                setResetTarget(emp);
                                setMenuId(null);
                              }}
                            />
                            <MenuItem
                              icon={Mail}
                              label="Resend welcome email"
                              disabled={!emp.user_id || busy}
                              onClick={() => void resendWelcome(emp)}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
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

      {/* click-away for action menu */}
      {menuId ? (
        <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenuId(null)} />
      ) : null}

      <EmployeeFormDialog
        open={formOpen}
        employee={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <EmployeeDetailPanel
        open={!!detail}
        employee={detail}
        students={students}
        employees={employees}
        appsToday={detail ? appsMap[detail.id]?.appsToday ?? 0 : 0}
        appsByStudent={appsByStudent}
        onClose={() => setDetail(null)}
        onEdit={() => {
          if (!detail) return;
          setEditing(detail);
          setFormOpen(true);
          setDetail(null);
        }}
      />

      <Dialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.status === "inactive" ? "Activate employee?" : "Deactivate employee?"}
        description={
          confirmToggle?.status === "inactive"
            ? `${confirmToggle.name} will regain access to the employee workspace.`
            : `${confirmToggle?.name} will lose access until reactivated. Assigned students stay assigned.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmToggle?.status === "inactive" ? "default" : "destructive"}
              disabled={busy}
              onClick={() => {
                if (!confirmToggle) return;
                void setStatus(
                  confirmToggle,
                  confirmToggle.status === "inactive" ? "active" : "inactive",
                );
              }}
            >
              {confirmToggle?.status === "inactive" ? "Activate" : "Deactivate"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">Confirm this account status change.</p>
      </Dialog>

      <Dialog
        open={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setResetPassword("");
        }}
        title="Reset password"
        description={resetTarget ? `Set a temporary password for ${resetTarget.name} and email it.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetTarget(null);
                setResetPassword("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void resetPw()}>
              {busy ? "Saving…" : "Reset & email"}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="reset-pw">Temporary password</Label>
          <Input
            id="reset-pw"
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      </Dialog>
    </AppShell>
  );
}

function Th({
  label,
  onClick,
  active,
  dir,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
}) {
  return (
    <th className="px-3 py-3 font-medium">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}
