import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserMinus, UserPlus } from "lucide-react";
import { Dialog, Select } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { employeeDailyTarget, employeeEffectiveDailyTarget, type Employee } from "@/lib/employees";
import type { Student } from "@/lib/students";
import { getInitials } from "@/features/employees/constants";
import { format } from "date-fns";

export function EmployeeDetailPanel({
  open,
  onClose,
  employee,
  students,
  employees,
  appsToday,
  appsByStudent = {},
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  students: Student[];
  employees: Employee[];
  appsToday: number;
  /** Today's application count keyed by student id */
  appsByStudent?: Record<string, number>;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [assignId, setAssignId] = useState("");

  const assigned = useMemo(
    () => (employee ? students.filter((s) => s.assigned_to === employee.id) : []),
    [employee, students],
  );
  const assignedActiveCount = useMemo(
    () => assigned.filter((s) => s.status !== "inactive").length,
    [assigned],
  );
  const available = useMemo(
    () => students.filter((s) => s.status !== "inactive" && (!employee || s.assigned_to !== employee.id)),
    [students, employee],
  );

  if (!employee) return null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["employee-apps-today"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const unassign = async (studentId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ assigned_to: null, last_assigned_to: employee.id })
        .eq("id", studentId);
      if (error) throw error;
      toast.success("Student unassigned.");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unassign.");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!assignId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({ assigned_to: employee.id })
        .eq("id", assignId);
      if (error) throw error;
      toast.success("Student assigned.");
      setAssignId("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign.");
    } finally {
      setBusy(false);
    }
  };

  const target = employeeEffectiveDailyTarget(employee, assignedActiveCount);
  const progress = target > 0 ? Math.round((appsToday / target) * 100) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={employee.name}
      description={employee.email}
      footer={
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onEdit}>
            Edit employee
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {employee.avatar || getInitials(employee.name)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge className="border-border bg-muted text-muted-foreground">
                {employee.job_role_category || "No category"}
              </Badge>
              <Badge
                className={
                  employee.status === "inactive"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                }
              >
                {employee.status === "inactive" ? "Inactive" : "Active"}
              </Badge>
              {employee.is_team_lead ? (
                <Badge className="border-sky-500/30 bg-sky-500/10 text-sky-800">Team Lead</Badge>
              ) : employee.can_access_all_students ? (
                <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-800">
                  All students
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Meta
            label="Daily target"
            value={`${target}/day (${assignedActiveCount} × ${employeeDailyTarget(employee)})`}
          />
          <Meta label="Apps today" value={`${appsToday} (${progress}%)`} />
          <Meta
            label="Joining date"
            value={
              employee.joining_date
                ? format(new Date(employee.joining_date), "MMM d, yyyy")
                : format(new Date(employee.created_at), "MMM d, yyyy")
            }
          />
          <Meta
            label="Last active"
            value={
              employee.last_active_at
                ? format(new Date(employee.last_active_at), "MMM d, yyyy h:mm a")
                : "—"
            }
          />
          <Meta label="Assigned students" value={String(assigned.length)} />
          <Meta label="Login linked" value={employee.user_id ? "Yes" : "No"} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Assigned students</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Apps today vs per-student target ({employeeDailyTarget(employee)})
          </p>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned.</p>
          ) : (
            <ul className="space-y-2">
              {assigned.map((s) => {
                const count = appsByStudent[s.id] ?? 0;
                const perTarget = employeeDailyTarget(employee);
                const pct = perTarget > 0 ? Math.round((count / perTarget) * 100) : 0;
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="tabular-nums">
                          <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {count}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">/ {perTarget}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{pct}%</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void unassign(s.id)}
                        title="Unassign"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Assign student</h3>
          <div className="flex gap-2">
            <Select className="flex-1" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
              <option value="">Select student…</option>
              {available.map((s) => {
                const current = employees.find((e) => e.id === s.assigned_to);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {current ? ` (now: ${current.name})` : " (unassigned)"}
                  </option>
                );
              })}
            </Select>
            <Button type="button" disabled={!assignId || busy} onClick={() => void assign()}>
              <UserPlus className="h-4 w-4" /> Assign
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
