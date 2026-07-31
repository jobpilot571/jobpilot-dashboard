import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox, Select } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeCredentials } from "@/lib/sendWelcomeCredentials";
import { isMissingColumnError, type Employee } from "@/lib/employees";
import { DEFAULT_DAILY_TARGET } from "@/lib/constants";
import { JOB_ROLE_CATEGORIES } from "@/features/employees/constants";

export function EmployeeFormDialog({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!employee;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Counselor");
  const [jobRoleCategory, setJobRoleCategory] = useState("");
  const [dailyTarget, setDailyTarget] = useState(String(DEFAULT_DAILY_TARGET));
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [accessAllStudents, setAccessAllStudents] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (employee) {
      setName(employee.name);
      setEmail(employee.email);
      setRole(employee.role || "Counselor");
      setJobRoleCategory(employee.job_role_category || "");
      setDailyTarget(String(employee.daily_target ?? DEFAULT_DAILY_TARGET));
      setAccessAllStudents(!!employee.can_access_all_students);
    } else {
      setName("");
      setEmail("");
      setRole("Counselor");
      setJobRoleCategory("");
      setDailyTarget(String(DEFAULT_DAILY_TARGET));
      setSendWelcomeEmail(true);
      setAccessAllStudents(false);
    }
  }, [employee, open]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["employees"] });
    void queryClient.invalidateQueries({ queryKey: ["email_logs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const persistDailyTarget = async (employeeId: string, target: number) => {
    const { error } = await supabase
      .from("employees")
      .update({ daily_target: target })
      .eq("id", employeeId);
    if (error && !isMissingColumnError(error)) throw error;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedRole = role.trim() || "Counselor";
    const target = Math.max(1, Number.parseInt(dailyTarget, 10) || DEFAULT_DAILY_TARGET);

    if (!trimmedName || !trimmedEmail) {
      toast.error("Name and email are required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && employee) {
        const { error } = await supabase
          .from("employees")
          .update({
            name: trimmedName,
            email: trimmedEmail,
            role: trimmedRole,
            job_role_category: jobRoleCategory,
            can_access_all_students: accessAllStudents,
          })
          .eq("id", employee.id);
        if (error) {
          if (isMissingColumnError(error) && accessAllStudents) {
            throw new Error(
              "All-students access column is missing. Apply migration 20260731000000_employee_all_students_access.sql first.",
            );
          }
          if (!isMissingColumnError(error)) throw error;
          // Column missing and flag false — fall back without the field
          const { error: fallbackErr } = await supabase
            .from("employees")
            .update({
              name: trimmedName,
              email: trimmedEmail,
              role: trimmedRole,
              job_role_category: jobRoleCategory,
            })
            .eq("id", employee.id);
          if (fallbackErr) throw fallbackErr;
        }
        await persistDailyTarget(employee.id, target);
        toast.success("Employee updated.");
      } else {
        const { data, error } = await supabase.functions.invoke("manage-employee", {
          body: {
            action: "create_employee",
            name: trimmedName,
            email: trimmedEmail,
            role: trimmedRole,
            job_role_category: jobRoleCategory,
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
        const generatedPassword = (data as { password?: string })?.password;

        // Set daily target on the new row (by email lookup if id not returned on employee)
        const { data: created } = await supabase
          .from("employees")
          .select("id")
          .eq("email", trimmedEmail)
          .maybeSingle();
        if (created?.id) {
          await persistDailyTarget(created.id, target);
          if (accessAllStudents) {
            const { error: flagErr } = await supabase
              .from("employees")
              .update({ can_access_all_students: true })
              .eq("id", created.id);
            if (flagErr && !isMissingColumnError(flagErr)) throw flagErr;
          }
        }

        if (newUserId && sendWelcomeEmail && generatedPassword) {
          const emailRes = await sendWelcomeCredentials({
            user_id: newUserId,
            email: trimmedEmail,
            name: trimmedName,
            role: "employee",
            password: generatedPassword,
          });
          if (emailRes.success) toast.success("Employee created and welcome email sent.");
          else toast.warning("Employee created, but welcome email failed. Resend from Actions.");
        } else {
          toast.success("Employee created.");
        }
      }
      invalidate();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit employee" : "Add employee"}
      description={isEdit ? "Update profile and daily target." : "Creates login credentials automatically."}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
          </Button>
        </div>
      }
    >
      <form id="employee-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-2">
          <Label htmlFor="emp-name">Full name</Label>
          <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-email">Email</Label>
          <Input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            disabled={isEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-role">Role / title</Label>
          <Input id="emp-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-category">Category</Label>
          <Select id="emp-category" value={jobRoleCategory} onChange={(e) => setJobRoleCategory(e.target.value)}>
            <option value="">Select category</option>
            {JOB_ROLE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp-target">Daily target (per student)</Label>
          <Input
            id="emp-target"
            type="number"
            min={1}
            value={dailyTarget}
            onChange={(e) => setDailyTarget(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Applications expected per day for this employee.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={accessAllStudents}
            onChange={(e) => setAccessAllStudents(e.target.checked)}
          />
          <span>
            <span className="font-medium">All students access</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Can view and work on every student. Does not grant admin (no employees, settings, or free trials
              admin).
            </span>
          </span>
        </label>
        {!isEdit ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendWelcomeEmail} onChange={(e) => setSendWelcomeEmail(e.target.checked)} />
            Send welcome email with credentials
          </label>
        ) : null}
      </form>
    </Dialog>
  );
}
