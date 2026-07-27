import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, Select } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError, type Employee } from "@/lib/employees";
import type { TrialStudent } from "@/hooks/useTrialStudents";
import {
  FOLLOW_UP_STATUSES,
  TRIAL_STATUSES,
  composeNotes,
  parseFollowUp,
  type FollowUpStatus,
  type TrialStatus,
} from "@/features/trials/constants";

export function TrialEditDialog({
  open,
  onClose,
  trial,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  trial: TrialStudent | null;
  employees: Employee[];
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [visa, setVisa] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [signupDate, setSignupDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [status, setStatus] = useState<TrialStatus>("new");
  const [followUp, setFollowUp] = useState<FollowUpStatus>("none");
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (!open || !trial) return;
    setFullName(trial.full_name);
    setPhone(trial.phone ?? "");
    setVisa(trial.visa_status ?? "");
    setTargetRole(trial.target_role ?? "");
    setSignupDate(trial.signup_date?.slice(0, 10) ?? "");
    setEndDate(trial.trial_end_date?.slice(0, 10) ?? "");
    setAssignedTo(trial.assigned_to ?? "unassigned");
    setStatus(trial.trial_status);
    const parsed = parseFollowUp(trial.notes);
    setFollowUp(parsed.followUp);
    setNoteBody(parsed.noteBody);
  }, [open, trial]);

  if (!trial) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const assigned = assignedTo === "unassigned" ? null : assignedTo;
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        visa_status: visa.trim(),
        target_role: targetRole.trim(),
        signup_date: signupDate,
        trial_end_date: endDate,
        assigned_to: assigned,
        assigned_at: assigned ? new Date().toISOString() : null,
        trial_status: assigned && status === "new" ? "assigned" : status,
        notes: composeNotes(followUp, noteBody),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("trial_students").update(payload).eq("id", trial.id);
      if (error) throw error;

      // On convert: mark matching student payment as paid (best-effort)
      if (status === "converted") {
        const { data: matched } = await supabase
          .from("students")
          .select("id, email")
          .ilike("email", trial.email)
          .maybeSingle();
        if (matched?.id) {
          const { error: payErr } = await supabase
            .from("students")
            .update({ payment_status: "paid" })
            .eq("id", matched.id);
          if (payErr && !isMissingColumnError(payErr)) {
            toast.warning("Trial converted, but student payment_status could not be updated.");
          }
        }
      }

      toast.success("Trial updated.");
      void queryClient.invalidateQueries({ queryKey: ["trial-students"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update trial.");
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
      title={`Edit trial — ${trial.full_name}`}
      description={trial.email}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="trial-form" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id="trial-form" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tr-name">Full name</Label>
          <Input id="tr-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-phone">Phone</Label>
          <Input id="tr-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-visa">Visa status</Label>
          <Input id="tr-visa" value={visa} onChange={(e) => setVisa(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tr-role">Target role</Label>
          <Input id="tr-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-start">Trial start</Label>
          <Input id="tr-start" type="date" value={signupDate} onChange={(e) => setSignupDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-end">Trial end</Label>
          <Input id="tr-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-assigned">Assigned employee</Label>
          <Select id="tr-assigned" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="unassigned">Unassigned</option>
            {activeEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-status">Trial status</Label>
          <Select id="tr-status" value={status} onChange={(e) => setStatus(e.target.value as TrialStatus)}>
            {TRIAL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-follow">Follow-up status</Label>
          <Select id="tr-follow" value={followUp} onChange={(e) => setFollowUp(e.target.value as FollowUpStatus)}>
            {FOLLOW_UP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tr-notes">Follow-up notes</Label>
          <Input id="tr-notes" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Follow-up status is stored in notes until a dedicated column is added.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
