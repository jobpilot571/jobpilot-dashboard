import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, Checkbox, Select } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeCredentials } from "@/lib/sendWelcomeCredentials";
import { isMissingColumnError } from "@/lib/employees";
import type { Employee } from "@/lib/employees";
import type { Student } from "@/lib/students";
import { JOB_ROLE_CATEGORIES } from "@/features/employees/constants";
import { PROGRAM_SUGGESTIONS } from "@/features/students/constants";
import { getTodayCST } from "@/lib/timezone";

export function StudentFormDialog({
  open,
  onClose,
  student,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  student?: Student | null;
  employees: Employee[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!student?.id;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [program, setProgram] = useState("");
  const [jobRoleCategory, setJobRoleCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [joiningDate, setJoiningDate] = useState("");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (student) {
      setName(student.name);
      setEmail(student.email);
      setPhone(student.phone ?? "");
      setProgram(student.program ?? "");
      setJobRoleCategory("");
      setAssignedTo(student.assigned_to ?? "unassigned");
      setJoiningDate(student.joining_date ?? student.applied_date ?? "");
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setProgram("");
      setJobRoleCategory("");
      setAssignedTo("unassigned");
      setJoiningDate(getTodayCST());
      setSendWelcomeEmail(true);
    }
  }, [student, open]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["email_logs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["student-app-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["student-billing"] });
  };

  const persistJoining = async (studentId: string, opts?: { seedBilling?: boolean }) => {
    const payload: Record<string, string | null> = {
      joining_date: joiningDate || null,
    };
    if (opts?.seedBilling) {
      payload.next_pay_date = joiningDate || null;
      payload.payment_status = "unpaid";
    }
    const { error } = await supabase.from("students").update(payload).eq("id", studentId);
    if (error && !isMissingColumnError(error)) throw error;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedProgram = program.trim();
    const assigned = assignedTo === "unassigned" ? null : assignedTo;
    const nextStatus = assigned ? "active" : "pending";

    if (!trimmedName || !trimmedEmail) {
      toast.error("Name and email are required.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && student) {
        const { error } = await supabase
          .from("students")
          .update({
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            program: trimmedProgram,
            assigned_to: assigned,
            last_assigned_to: assigned ?? student.last_assigned_to,
            status: student.status === "inactive" ? "inactive" : assigned ? "active" : student.status || "pending",
          })
          .eq("id", student.id);
        if (error) throw error;
        await persistJoining(student.id);
        toast.success("Student updated.");
        invalidate();
        onClose();
        return;
      }

      const baseInsert = {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || "",
        program: trimmedProgram || "",
        assigned_to: assigned,
        last_assigned_to: assigned,
        status: nextStatus,
        applied_date: joiningDate || getTodayCST(),
      };

      let newStudent: { id: string } | null = null;
      const withProfile = await supabase
        .from("students")
        .insert({
          ...baseInsert,
          profile_json: jobRoleCategory ? { job_role_category: jobRoleCategory } : {},
        })
        .select("id")
        .single();

      if (withProfile.error && isMissingColumnError(withProfile.error)) {
        const fallback = await supabase.from("students").insert(baseInsert).select("id").single();
        if (fallback.error) throw fallback.error;
        newStudent = fallback.data;
      } else if (withProfile.error) {
        throw withProfile.error;
      } else {
        newStudent = withProfile.data;
      }

      if (!newStudent?.id) throw new Error("Student insert returned no id.");

      await persistJoining(newStudent.id, { seedBilling: true });

      try {
        const { data: loginData, error: loginErr } = await supabase.functions.invoke("manage-employee", {
          body: {
            action: "create_student_login",
            student_id: newStudent.id,
            email: trimmedEmail,
          },
        });
        if (loginErr) {
          const msg =
            (loginData && typeof loginData === "object" && "error" in loginData &&
              String((loginData as { error: unknown }).error)) ||
            loginErr.message;
          throw new Error(msg);
        }
        if (loginData && typeof loginData === "object" && "error" in loginData && (loginData as { error: unknown }).error) {
          throw new Error(String((loginData as { error: unknown }).error));
        }

        const newUserId = (loginData as { user_id?: string })?.user_id;
        const generatedPassword = (loginData as { password?: string })?.password;

        // Confirm link landed on the student row
        const { data: linkedRow } = await supabase
          .from("students")
          .select("user_id")
          .eq("id", newStudent.id)
          .maybeSingle();
        if (!linkedRow?.user_id) {
          throw new Error("Login was created but not linked to the student profile.");
        }

        if (newUserId && sendWelcomeEmail && generatedPassword) {
          const emailRes = await sendWelcomeCredentials({
            user_id: newUserId,
            email: trimmedEmail,
            name: trimmedName,
            role: "student",
            password: generatedPassword,
          });
          if (emailRes.success) toast.success("Student created and welcome email sent.");
          else toast.warning("Student created; welcome email failed. Resend from Actions.");
        } else {
          toast.success("Student created with login.");
        }
      } catch (loginEx) {
        toast.warning(
          `Student saved, but login failed: ${loginEx instanceof Error ? loginEx.message : "unknown error"}. Use Create login from Actions.`,
        );
      }

      invalidate();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save student.");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.status !== "inactive");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={isEdit ? "Edit student" : "Add student"}
      description={isEdit ? "Update profile and assignment. Billing is on Payments." : "Creates a login automatically."}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create student"}
          </Button>
        </div>
      }
    >
      <form id="student-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stu-name">Full name</Label>
            <Input id="stu-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stu-email">Email</Label>
            <Input
              id="stu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isEdit}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stu-phone">Phone</Label>
            <Input id="stu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stu-joining">Start date</Label>
            <Input id="stu-joining" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Admin only. This date drives the payment cycle and cannot be changed on Payments.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stu-program">Program / target role</Label>
            <Input
              id="stu-program"
              list="program-suggestions"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. Data Analyst"
              maxLength={100}
            />
            <datalist id="program-suggestions">
              {PROGRAM_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="stu-category">Job category</Label>
              <Select id="stu-category" value={jobRoleCategory} onChange={(e) => setJobRoleCategory(e.target.value)}>
                <option value="">Optional</option>
                {JOB_ROLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div />
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stu-assigned">Assigned employee</Label>
            <Select id="stu-assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="unassigned">Unassigned</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

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
