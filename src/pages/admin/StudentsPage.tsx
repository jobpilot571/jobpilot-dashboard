import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
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
import { StatusDot } from "@/components/ui/status-dot";
import { Dialog, Select } from "@/components/ui/dialog";
import { StudentFormDialog } from "@/components/students/StudentFormDialog";
import { StudentDetailPanel } from "@/components/students/StudentDetailPanel";
import { EmailStatusBadge } from "@/components/employees/EmailStatusBadge";
import { useEmployees } from "@/hooks/useEmployees";
import { useStudents } from "@/hooks/useStudents";
import { useWelcomeEmailLogs } from "@/hooks/useEmailLogs";
import { useStudentAppStats } from "@/hooks/useStudentAppStats";
import { getStudentBucket, studentStartDate, type Student } from "@/lib/students";
import { livePaymentStatus } from "@/lib/billing";
import { formatRosterDate } from "@/lib/timezone";
import { sendWelcomeCredentials } from "@/lib/sendWelcomeCredentials";
import { runPaymentReminders } from "@/hooks/usePayments";
import { supabase } from "@/integrations/supabase/client";
import { getInitials } from "@/features/employees/constants";
import {
  STUDENT_PAGE_SIZE,
  type StudentSortKey,
  type StudentStatusFilter,
} from "@/features/students/constants";
import { cn } from "@/lib/utils";

export default function AdminStudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: students = [], isLoading, isError, error, refetch } = useStudents();
  const { data: employees = [] } = useEmployees();
  const { data: statsMap = {} } = useStudentAppStats();
  const emailLogs = useWelcomeEmailLogs(students.map((s) => s.user_id));

  const statusFromUrl = searchParams.get("status");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>(() =>
    statusFromUrl === "pending" ||
    statusFromUrl === "active" ||
    statusFromUrl === "inactive" ||
    statusFromUrl === "all"
      ? statusFromUrl
      : "active",
  );
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<StudentSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s === "pending" || s === "active" || s === "inactive" || s === "all") {
      setStatusFilter(s);
      setPage(1);
    }
  }, [searchParams]);

  const applyStatusFilter = (key: StudentStatusFilter) => {
    setStatusFilter(key);
    setPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("status", key);
        return next;
      },
      { replace: true },
    );
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [detail, setDetail] = useState<Student | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [confirmToggle, setConfirmToggle] = useState<Student | null>(null);
  const [inactiveReason, setInactiveReason] = useState("Subscription ended");
  const [resetTarget, setResetTarget] = useState<Student | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void runPaymentReminders();
  }, []);

  const empName = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.name])),
    [employees],
  );

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let inactive = 0;
    for (const s of students) {
      const b = getStudentBucket(s);
      if (b === "inactive") inactive += 1;
      else if (b === "assigned") active += 1;
      else pending += 1;
    }
    return { all: students.length, active, pending, inactive };
  }, [students]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = students.filter((s) => {
      const bucket = getStudentBucket(s);
      if (statusFilter === "active" && bucket !== "assigned") return false;
      if (statusFilter === "pending" && bucket !== "unassigned") return false;
      if (statusFilter === "inactive" && bucket !== "inactive") return false;
      if (employeeFilter !== "all") {
        if (employeeFilter === "unassigned") {
          if (s.assigned_to) return false;
        } else if (s.assigned_to !== employeeFilter) return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.program || "").toLowerCase().includes(q) ||
        (s.assigned_to ? (empName[s.assigned_to] || "").toLowerCase().includes(q) : false)
      );
    });

    list = [...list].sort((a, b) => {
      const aApps = statsMap[a.id]?.appCount ?? 0;
      const bApps = statsMap[b.id]?.appCount ?? 0;
      const aInt = statsMap[a.id]?.interviewCount ?? 0;
      const bInt = statsMap[b.id]?.interviewCount ?? 0;
      let cmp = 0;
      switch (sortKey) {
        case "program":
          cmp = (a.program || "").localeCompare(b.program || "");
          break;
        case "assigned":
          cmp = (a.assigned_to ? empName[a.assigned_to] || "" : "").localeCompare(
            b.assigned_to ? empName[b.assigned_to] || "" : "",
          );
          break;
        case "apps":
          cmp = aApps - bApps;
          break;
        case "interviews":
          cmp = aInt - bInt;
          break;
        case "payment":
          cmp = livePaymentStatus(a).localeCompare(livePaymentStatus(b));
          break;
        case "startDate":
          cmp = (studentStartDate(a) || "").localeCompare(studentStartDate(b) || "");
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [students, search, statusFilter, employeeFilter, sortKey, sortDir, statsMap, empName]);

  const pageCount = Math.max(1, Math.ceil(rows.length / STUDENT_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * STUDENT_PAGE_SIZE, page * STUDENT_PAGE_SIZE);

  const toggleSort = (key: StudentSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "apps" || key === "interviews" || key === "startDate" ? "desc" : "asc");
    }
  };

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["email_logs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["student-app-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["employee-apps-today"] });
  };

  const setActiveStatus = async (student: Student, action: "active" | "inactive") => {
    setBusy(true);
    try {
      const payload =
        action === "inactive"
          ? {
              status: "inactive" as const,
              inactive_at: new Date().toISOString(),
              inactive_reason: inactiveReason,
              last_assigned_to: student.assigned_to ?? student.last_assigned_to,
              assigned_to: null as string | null,
            }
          : {
              status: "active" as const,
              inactive_at: null,
              inactive_reason: null,
            };

      const { error } = await supabase.from("students").update(payload).eq("id", student.id);
      if (error) throw error;
      toast.success(action === "inactive" ? "Student deactivated." : "Student activated.");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(false);
      setConfirmToggle(null);
    }
  };

  const resendWelcome = async (student: Student) => {
    if (!student.user_id) {
      toast.error("No login linked. Edit/create login from Actions after provisioning.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendWelcomeCredentials({
        user_id: student.user_id,
        email: student.email,
        name: student.name,
        role: "student",
        is_resend: true,
        reset_password: true,
      });
      if (!res.success) throw new Error(res.error || "Failed to send.");
      toast.success("New login / password emailed. Old passwords no longer work.");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setBusy(false);
      setMenuId(null);
    }
  };

  const createLogin = async (student: Student) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-employee", {
        body: {
          action: "create_student_login",
          student_id: student.id,
          email: student.email,
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
      const newUserId = (data as { user_id?: string })?.user_id;
      const password = (data as { password?: string })?.password;
      if (newUserId && password) {
        const emailRes = await sendWelcomeCredentials({
          user_id: newUserId,
          email: student.email,
          name: student.name,
          role: "student",
          password,
        });
        if (emailRes.success) toast.success("Login created and welcome email sent.");
        else toast.warning(emailRes.error || "Login created; welcome email failed.");
      } else {
        toast.success("Login created.");
      }
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create login.");
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
          email: resetTarget.email,
          role: "student",
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
      const effectiveUserId =
        (data as { user_id?: string } | null)?.user_id || resetTarget.user_id;
      const emailRes = await sendWelcomeCredentials({
        user_id: effectiveUserId,
        email: resetTarget.email,
        name: resetTarget.name,
        role: "student",
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

  const activeEmployees = employees.filter((e) => e.status !== "inactive");

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Students</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Roster, assignments, payment status, and application activity.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add student
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, program, employee…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              className="h-10 w-full max-w-xs"
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All employees</option>
              <option value="unassigned">Unassigned only</option>
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
                ["all", `All (${counts.all})`],
                ["active", `Active (${counts.active})`],
                ["pending", `Pending / Unassigned (${counts.pending})`],
                ["inactive", `Inactive (${counts.inactive})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyStatusFilter(key)}
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
            <p className="font-medium text-destructive">Could not load students</p>
            <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th label="Student" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
                  <Th label="Start Date" onClick={() => toggleSort("startDate")} active={sortKey === "startDate"} dir={sortDir} />
                  <Th label="Program" onClick={() => toggleSort("program")} active={sortKey === "program"} dir={sortDir} />
                  <Th label="Assigned to" onClick={() => toggleSort("assigned")} active={sortKey === "assigned"} dir={sortDir} />
                  <Th label="Apps" onClick={() => toggleSort("apps")} active={sortKey === "apps"} dir={sortDir} />
                  <Th label="Interviews" onClick={() => toggleSort("interviews")} active={sortKey === "interviews"} dir={sortDir} />
                  <Th label="Payment" onClick={() => toggleSort("payment")} active={sortKey === "payment"} dir={sortDir} />
                  <th className="px-3 py-3 font-medium">Welcome email</th>
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
                      No students match your filters.
                    </td>
                  </tr>
                ) : null}
                {pageRows.map((stu) => {
                  const bucket = getStudentBucket(stu);
                  const stats = statsMap[stu.id] ?? { appCount: 0, interviewCount: 0, todayCount: 0 };
                  const log = stu.user_id ? emailLogs.data?.[stu.user_id] : null;
                  const start = studentStartDate(stu);
                  const statusTone =
                    bucket === "inactive" ? "inactive" : bucket === "unassigned" ? "pending" : "active";

                  return (
                    <tr key={stu.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <Link
                          to={`/admin/students/${stu.id}`}
                          className="flex items-center gap-3 text-left hover:opacity-90"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(stu.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-primary hover:underline">
                              <StatusDot tone={statusTone} pulse={statusTone === "active"} />
                              <span className="truncate">{stu.name}</span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{stu.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {formatRosterDate(start)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{stu.program || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {stu.assigned_to ? empName[stu.assigned_to] || "—" : "Unassigned"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-baseline gap-2 whitespace-nowrap">
                          <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                            {stats.appCount}
                          </span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {stats.todayCount} today
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{stats.interviewCount}</td>
                      <td className="px-3 py-3">
                        <PaymentBadge status={livePaymentStatus(stu)} />
                      </td>
                      <td className="px-3 py-3">
                        <EmailStatusBadge log={log} />
                      </td>
                      <td className="relative px-3 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setMenuId((id) => (id === stu.id ? null : stu.id))}
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {menuId === stu.id ? (
                          <div className="absolute right-3 z-20 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
                            <MenuItem
                              icon={UserCheck}
                              label="View profile & apps"
                              onClick={() => {
                                setMenuId(null);
                                navigate(`/admin/students/${stu.id}`);
                              }}
                            />
                            <MenuItem
                              icon={Pencil}
                              label="Edit"
                              onClick={() => {
                                setEditing(stu);
                                setFormOpen(true);
                                setMenuId(null);
                              }}
                            />
                            <MenuItem
                              icon={bucket === "inactive" ? UserCheck : UserX}
                              label={bucket === "inactive" ? "Activate" : "Deactivate"}
                              onClick={() => {
                                setConfirmToggle(stu);
                                setMenuId(null);
                              }}
                            />
                            {!stu.user_id ? (
                              <MenuItem
                                icon={KeyRound}
                                label="Create login"
                                disabled={busy}
                                onClick={() => void createLogin(stu)}
                              />
                            ) : (
                              <>
                                <MenuItem
                                  icon={KeyRound}
                                  label="Reset password"
                                  onClick={() => {
                                    setResetTarget(stu);
                                    setMenuId(null);
                                  }}
                                />
                                <MenuItem
                                  icon={Mail}
                                  label="Resend welcome email"
                                  disabled={busy}
                                  onClick={() => void resendWelcome(stu)}
                                />
                              </>
                            )}
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
              Showing {rows.length === 0 ? 0 : (page - 1) * STUDENT_PAGE_SIZE + 1}–
              {Math.min(page * STUDENT_PAGE_SIZE, rows.length)} of {rows.length}
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

      {menuId ? (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label="Close menu"
          onClick={() => setMenuId(null)}
        />
      ) : null}

      <StudentFormDialog
        open={formOpen}
        student={editing}
        employees={employees}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <StudentDetailPanel
        open={!!detail}
        student={detail}
        employees={employees}
        appCount={detail ? statsMap[detail.id]?.appCount ?? 0 : 0}
        interviewCount={detail ? statsMap[detail.id]?.interviewCount ?? 0 : 0}
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
        title={
          confirmToggle && getStudentBucket(confirmToggle) === "inactive"
            ? "Activate student?"
            : "Deactivate student?"
        }
        description={
          confirmToggle && getStudentBucket(confirmToggle) === "inactive"
            ? `${confirmToggle.name} will regain portal access.`
            : `${confirmToggle?.name} will lose access. They will also be unassigned from their counselor.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                confirmToggle && getStudentBucket(confirmToggle) === "inactive" ? "default" : "destructive"
              }
              disabled={busy}
              onClick={() => {
                if (!confirmToggle) return;
                const action = getStudentBucket(confirmToggle) === "inactive" ? "active" : "inactive";
                void setActiveStatus(confirmToggle, action);
              }}
            >
              Confirm
            </Button>
          </div>
        }
      >
        {confirmToggle && getStudentBucket(confirmToggle) !== "inactive" ? (
          <div className="space-y-2">
            <Label htmlFor="inactive-reason">Reason</Label>
            <Select id="inactive-reason" value={inactiveReason} onChange={(e) => setInactiveReason(e.target.value)}>
              <option>Subscription ended</option>
              <option>Placed</option>
              <option>Paused by request</option>
              <option>Non-payment</option>
              <option>Other</option>
            </Select>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Confirm this account status change.</p>
        )}
      </Dialog>

      <Dialog
        open={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setResetPassword("");
        }}
        title="Reset password"
        description={resetTarget ? `Temporary password for ${resetTarget.name}` : undefined}
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
          <Label htmlFor="stu-reset-pw">Temporary password</Label>
          <Input
            id="stu-reset-pw"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
      </Dialog>
    </AppShell>
  );
}

function PaymentBadge({ status }: { status?: string | null }) {
  const s = status === "paid" ? "paid" : status === "waived" || status === "n/a" ? status : "unpaid";
  const cls =
    s === "paid"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : s === "partial"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : s === "waived" || s === "n/a"
          ? "border-border bg-muted text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return <Badge className={cls}>{s}</Badge>;
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
