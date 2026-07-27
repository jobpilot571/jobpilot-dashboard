import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentApplications } from "@/hooks/useStudentAppStats";
import type { Employee } from "@/lib/employees";
import { getStudentBucket, type Student } from "@/lib/students";
import { getInitials } from "@/features/employees/constants";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function StudentDetailPanel({
  open,
  onClose,
  student,
  employees,
  appCount,
  interviewCount,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  employees: Employee[];
  appCount: number;
  interviewCount: number;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: apps = [], isLoading: appsLoading } = useStudentApplications(student?.id);
  const [assignTo, setAssignTo] = useState("");
  const [busy, setBusy] = useState(false);

  if (!student) return null;

  const bucket = getStudentBucket(student);
  const assignee = employees.find((e) => e.id === student.assigned_to);
  const activeEmployees = employees.filter((e) => e.status !== "inactive");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["employee-apps-today"] });
  };

  const reassign = async () => {
    const value = assignTo === "unassigned" ? null : assignTo || null;
    if (!assignTo) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          assigned_to: value,
          last_assigned_to: student.assigned_to ?? student.last_assigned_to,
        })
        .eq("id", student.id);
      if (error) throw error;
      toast.success(value ? "Student reassigned." : "Student unassigned.");
      setAssignTo("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={student.name}
      description={student.email}
      footer={
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onEdit}>
            Edit student
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {getInitials(student.name)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{student.program || "No program"}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge
                className={
                  bucket === "inactive"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : bucket === "unassigned"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                }
              >
                {bucket === "inactive" ? "Inactive" : bucket === "unassigned" ? "Pending / Unassigned" : "Active"}
              </Badge>
              <Badge className="border-border bg-muted text-muted-foreground">
                Payment: {student.payment_status ?? "unpaid"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Meta label="Assigned to" value={assignee?.name ?? "Unassigned"} />
          <Meta label="Phone" value={student.phone || "—"} />
          <Meta label="Applications" value={String(appCount)} />
          <Meta label="Interviews" value={String(interviewCount)} />
          <Meta
            label="Joining date"
            value={
              student.joining_date || student.applied_date
                ? format(new Date(student.joining_date || student.applied_date), "MMM d, yyyy")
                : "—"
            }
          />
          <Meta label="Login linked" value={student.user_id ? "Yes" : "No"} />
          {student.payment_amount != null ? (
            <Meta label="Payment amount" value={`$${Number(student.payment_amount).toFixed(2)}`} />
          ) : null}
          {student.payment_method ? <Meta label="Payment method" value={student.payment_method} /> : null}
        </div>

        {student.inactive_reason ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Inactive reason: {student.inactive_reason}
          </p>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Assign / reassign</h3>
          <div className="flex gap-2">
            <Select className="flex-1" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Select…</option>
              <option value="unassigned">Unassigned</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Button type="button" disabled={!assignTo || busy} onClick={() => void reassign()}>
              Apply
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent applications</h3>
          {appsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {apps.map((app) => (
                <li key={app.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{app.job_role}</p>
                      <p className="truncate text-xs text-muted-foreground">{app.company_name}</p>
                    </div>
                    <span className="shrink-0 text-[11px] capitalize text-primary">{app.status}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{app.applied_date}</p>
                </li>
              ))}
            </ul>
          )}
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
