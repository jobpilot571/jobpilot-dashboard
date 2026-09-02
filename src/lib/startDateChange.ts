import { supabase } from "@/integrations/supabase/client";
import { isMissingColumnError } from "@/lib/employees";
import { studentStartDate, type Student } from "@/lib/students";

export interface StartDateChangeActor {
  id: string | null;
  name: string;
  email: string;
}

export interface ApplyStartDateChangeResult {
  emailSent: boolean;
  emailError?: string;
}

export async function applyStartDateChange(opts: {
  student: Student;
  newDate: string;
  actor: StartDateChangeActor;
}): Promise<ApplyStartDateChangeResult> {
  const prev = (studentStartDate(opts.student) || "").slice(0, 10);
  const next = opts.newDate.slice(0, 10);
  if (!next) throw new Error("Choose a new start date.");
  if (prev === next) throw new Error("Start date is unchanged.");

  const payload: {
    joining_date: string | null;
    next_pay_date?: string | null;
  } = { joining_date: next };
  if (
    !opts.student.payment_date &&
    (!opts.student.next_pay_date || opts.student.next_pay_date === prev)
  ) {
    payload.next_pay_date = next;
  }

  const { error: updateError } = await supabase.from("students").update(payload).eq("id", opts.student.id);
  if (updateError && !isMissingColumnError(updateError)) throw updateError;

  const { error: histError } = await supabase.from("student_start_date_history").insert({
    student_id: opts.student.id,
    old_date: prev || null,
    new_date: next,
    changed_by: opts.actor.id,
    changed_by_name: opts.actor.name,
    changed_by_email: opts.actor.email,
  });
  if (histError && !isMissingColumnError(histError)) throw histError;

  const { data, error } = await supabase.functions.invoke("notify-start-date-change", {
    body: {
      student_id: opts.student.id,
      name: opts.student.name,
      old_date: prev || null,
      new_date: next,
      changed_by_name: opts.actor.name || opts.actor.email,
    },
  });
  const bodyError =
    data && typeof data === "object" && "error" in data
      ? String((data as { error: unknown }).error ?? "")
      : "";
  if (error || bodyError) {
    return {
      emailSent: false,
      emailError: bodyError || error?.message || "Email failed to send",
    };
  }
  return { emailSent: true };
}
