import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PAYMENT_STATUS, type PaymentStatus } from "@/lib/constants";
import { livePaymentStatus, nextPayDateAfter } from "@/lib/billing";
import { studentStartDate, type Student } from "@/lib/students";
import { getTodayCST } from "@/lib/timezone";
import { isMissingColumnError } from "@/lib/employees";

// New tables may not be in generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StudentBillingRow {
  student_id: string;
  student_name: string;
  student_email: string;
  student_status: string;
  start_date: string | null;
  rate: number;
  status: PaymentStatus | string;
  payment_method: string;
  paid_at: string | null;
  next_pay_date: string | null;
  notes: string;
  reminder_sent_on: string | null;
}

export interface EmployeeSalaryRow {
  id?: string;
  employee_id: string;
  year: number;
  month: number;
  amount: number;
  status: PaymentStatus | string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
  employee_name?: string;
  employee_email?: string;
  employee_status?: string;
}

type PaymentSave = {
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
};

export type StudentBillingSave = {
  student_id: string;
  rate: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  next_pay_date: string | null;
  notes: string;
};

export interface StudentMonthRow {
  student_id: string;
  student_name: string;
  student_email: string;
  start_date: string | null;
  rate: number;
  status: PaymentStatus | string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
  recorded: boolean;
}

export interface StudentPaymentRecord {
  id?: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_status: string;
  year: number;
  month: number;
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
}

function toBillingRow(s: Student): StudentBillingRow {
  const start = studentStartDate(s);
  const live = livePaymentStatus(s);
  return {
    student_id: s.id,
    student_name: s.name,
    student_email: s.email,
    student_status: s.status,
    start_date: start,
    rate: Number(s.payment_amount ?? 0),
    status: live,
    payment_method: s.payment_method ?? "",
    paid_at: s.payment_date ?? null,
    next_pay_date: s.next_pay_date ?? start ?? null,
    notes: s.payment_notes ?? "",
    reminder_sent_on: s.payment_reminder_sent_on ?? null,
  };
}

export function useStudentBilling() {
  return useQuery({
    queryKey: ["student-billing"],
    queryFn: async (): Promise<StudentBillingRow[]> => {
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, name, email, status, joining_date, applied_date, created_at, payment_amount, payment_status, payment_method, payment_date, payment_notes, next_pay_date, payment_reminder_sent_on",
        )
        .order("name");
      if (!error) return ((data ?? []) as Student[]).map(toBillingRow);
      if (!isMissingColumnError(error)) throw error;

      const fallback = await supabase
        .from("students")
        .select(
          "id, name, email, status, joining_date, applied_date, created_at, payment_amount, payment_status, payment_method, payment_date, payment_notes",
        )
        .order("name");
      if (fallback.error) throw fallback.error;
      return ((fallback.data ?? []) as Student[]).map(toBillingRow);
    },
  });
}

export function useUpsertStudentBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: StudentBillingSave) => {
      const today = getTodayCST();
      let paidAt = input.paid_at || null;
      let nextPay = input.next_pay_date || null;
      let status = input.status;

      if (status === "paid") {
        paidAt = paidAt || today;
        if (!nextPay || nextPay <= paidAt) {
          const { data: stu } = await supabase
            .from("students")
            .select("joining_date, applied_date, created_at")
            .eq("id", input.student_id)
            .maybeSingle();
          nextPay = nextPayDateAfter(paidAt, stu?.joining_date || stu?.applied_date || paidAt);
        }
      } else if (status !== "waived" && status !== "n/a") {
        status = livePaymentStatus({
          payment_status: status,
          next_pay_date: nextPay,
          payment_date: paidAt,
          joining_date: null,
        });
      }

      const payload = {
        payment_amount: input.rate,
        payment_status: status,
        payment_method: input.payment_method || null,
        payment_date: paidAt,
        payment_notes: input.notes || null,
        next_pay_date: nextPay,
      };

      const { error } = await supabase.from("students").update(payload).eq("id", input.student_id);
      if (error && isMissingColumnError(error)) {
        const { next_pay_date: _n, ...rest } = payload;
        const retry = await supabase.from("students").update(rest).eq("id", input.student_id);
        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }

      const period = paidAt || getTodayCST();
      const [y, m] = period.split("-").map(Number);
      await db.from("student_payments").upsert(
        {
          student_id: input.student_id,
          year: y,
          month: m,
          amount: input.rate,
          status,
          payment_method: input.payment_method,
          paid_at: paidAt,
          notes: input.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,year,month" },
      );

      return payload;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-billing"] });
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["student-payments"] });
      void qc.invalidateQueries({ queryKey: ["student-month-payments"] });
      void qc.invalidateQueries({ queryKey: ["student-payment-records"] });
      toast.success("Payment saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save payment."),
  });
}

export function useStudentMonthPayments(year: number, month: number) {
  return useQuery({
    queryKey: ["student-month-payments", year, month],
    queryFn: async (): Promise<StudentMonthRow[]> => {
      const { data: students, error: stuErr } = await supabase
        .from("students")
        .select(
          "id, name, email, status, joining_date, applied_date, created_at, payment_amount, payment_status, payment_method, payment_date, payment_notes",
        )
        .neq("status", "inactive")
        .order("name");
      if (stuErr) throw stuErr;

      const { data: pays, error: payErr } = await db
        .from("student_payments")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (payErr && !isMissingColumnError(payErr)) throw payErr;

      const byStu = new Map(
        ((pays ?? []) as { student_id: string }[]).map((p) => [p.student_id, p as Record<string, unknown>]),
      );

      return ((students ?? []) as Student[]).map((s) => {
        const existing = byStu.get(s.id);
        const start = studentStartDate(s);
        if (existing) {
          return {
            student_id: s.id,
            student_name: s.name,
            student_email: s.email,
            start_date: start,
            rate: Number(existing.amount ?? s.payment_amount ?? 0),
            status: String(existing.status ?? "unpaid"),
            payment_method: String(existing.payment_method ?? ""),
            paid_at: (existing.paid_at as string | null) ?? null,
            notes: String(existing.notes ?? ""),
            recorded: true,
          };
        }
        return {
          student_id: s.id,
          student_name: s.name,
          student_email: s.email,
          start_date: start,
          rate: Number(s.payment_amount ?? 0),
          status: "unpaid",
          payment_method: "",
          paid_at: null,
          notes: "",
          recorded: false,
        };
      });
    },
  });
}

export function useUpsertStudentMonthPayment(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      student_id: string;
      start_date: string | null;
      rate: number;
      status: string;
      payment_method: string;
      paid_at: string | null;
      notes: string;
    }) => {
      const today = getTodayCST();
      const [cy, cm] = today.split("-").map(Number);
      let status = input.status === "partial" ? "unpaid" : input.status;
      let paidAt = input.paid_at || null;
      if (status === "paid") paidAt = paidAt || today;

      const { error } = await db.from("student_payments").upsert(
        {
          student_id: input.student_id,
          year,
          month,
          amount: input.rate,
          status,
          payment_method: input.payment_method,
          paid_at: paidAt,
          notes: input.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,year,month" },
      );
      if (error) throw error;

      const studentUpdate: {
        payment_amount: number;
        payment_status?: string;
        payment_date?: string | null;
        payment_method?: string | null;
        payment_notes?: string | null;
        next_pay_date?: string | null;
      } = {
        payment_amount: input.rate,
      };
      if (status === "paid") {
        studentUpdate.payment_status = "paid";
        studentUpdate.payment_date = paidAt;
        studentUpdate.payment_method = input.payment_method || null;
        studentUpdate.payment_notes = input.notes || null;
        studentUpdate.next_pay_date = nextPayDateAfter(paidAt!, input.start_date);
      } else if (year === cy && month === cm) {
        studentUpdate.payment_status = status;
        studentUpdate.payment_method = input.payment_method || null;
        studentUpdate.payment_notes = input.notes || null;
        if (status !== "waived" && status !== "n/a") {
          studentUpdate.payment_status = livePaymentStatus({
            payment_status: status,
            next_pay_date: null,
            payment_date: paidAt,
            joining_date: input.start_date,
          });
        }
      }

      const { error: stuErr } = await supabase.from("students").update(studentUpdate).eq("id", input.student_id);
      if (stuErr && !isMissingColumnError(stuErr)) throw stuErr;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-month-payments", year, month] });
      void qc.invalidateQueries({ queryKey: ["student-payment-records"] });
      void qc.invalidateQueries({ queryKey: ["student-payment-history"] });
      void qc.invalidateQueries({ queryKey: ["student-billing"] });
      void qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Month payment saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save month payment."),
  });
}

export function useStudentPaymentRecords() {
  return useQuery({
    queryKey: ["student-payment-records"],
    queryFn: async (): Promise<StudentPaymentRecord[]> => {
      const { data: pays, error } = await db
        .from("student_payments")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;

      const { data: students, error: stuErr } = await supabase
        .from("students")
        .select("id, name, email, status");
      if (stuErr) throw stuErr;

      const byId = new Map((students ?? []).map((s) => [s.id, s]));
      return ((pays ?? []) as Record<string, unknown>[]).map((p) => {
        const stu = byId.get(String(p.student_id));
        return {
          id: p.id ? String(p.id) : undefined,
          student_id: String(p.student_id),
          student_name: stu?.name ?? "Unknown student",
          student_email: stu?.email ?? "",
          student_status: stu?.status ?? "",
          year: Number(p.year),
          month: Number(p.month),
          amount: Number(p.amount ?? 0),
          status: String(p.status ?? "unpaid"),
          payment_method: String(p.payment_method ?? ""),
          paid_at: (p.paid_at as string | null) ?? null,
          notes: String(p.notes ?? ""),
        };
      });
    },
  });
}

export function useStudentPaymentHistory(studentId: string | null) {
  return useQuery({
    queryKey: ["student-payment-history", studentId],
    enabled: Boolean(studentId),
    queryFn: async (): Promise<StudentPaymentRecord[]> => {
      const { data: pays, error } = await db
        .from("student_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;

      const { data: stu } = await supabase
        .from("students")
        .select("id, name, email, status")
        .eq("id", studentId!)
        .maybeSingle();

      return ((pays ?? []) as Record<string, unknown>[]).map((p) => ({
        id: p.id ? String(p.id) : undefined,
        student_id: String(p.student_id),
        student_name: stu?.name ?? "Unknown student",
        student_email: stu?.email ?? "",
        student_status: stu?.status ?? "",
        year: Number(p.year),
        month: Number(p.month),
        amount: Number(p.amount ?? 0),
        status: String(p.status ?? "unpaid"),
        payment_method: String(p.payment_method ?? ""),
        paid_at: (p.paid_at as string | null) ?? null,
        notes: String(p.notes ?? ""),
      }));
    },
  });
}

export function useEmployeeSalaries(year: number, month: number) {
  return useQuery({
    queryKey: ["employee-salaries", year, month],
    queryFn: async (): Promise<EmployeeSalaryRow[]> => {
      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("id, name, email, status")
        .order("name");
      if (empErr) throw empErr;

      const { data: salaries, error: salErr } = await db
        .from("employee_salaries")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (salErr) throw salErr;

      const byEmp = new Map(
        ((salaries ?? []) as { employee_id: string }[]).map((p) => [
          p.employee_id,
          p as Record<string, unknown>,
        ]),
      );

      return (employees ?? []).map((e) => {
        const existing = byEmp.get(e.id);
        if (existing) {
          return {
            id: String(existing.id),
            employee_id: e.id,
            year,
            month,
            amount: Number(existing.amount ?? 0),
            status: String(existing.status ?? DEFAULT_PAYMENT_STATUS),
            payment_method: String(existing.payment_method ?? ""),
            paid_at: (existing.paid_at as string | null) ?? null,
            notes: String(existing.notes ?? ""),
            employee_name: e.name,
            employee_email: e.email,
            employee_status: e.status,
          };
        }
        return {
          employee_id: e.id,
          year,
          month,
          amount: 0,
          status: DEFAULT_PAYMENT_STATUS,
          payment_method: "",
          paid_at: null,
          notes: "",
          employee_name: e.name,
          employee_email: e.email,
          employee_status: e.status,
        };
      });
    },
  });
}

export function useUpsertEmployeeSalary(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employee_id: string } & PaymentSave) => {
      const { data, error } = await db
        .from("employee_salaries")
        .upsert(
          {
            employee_id: input.employee_id,
            year,
            month,
            amount: input.amount,
            status: input.status,
            payment_method: input.payment_method,
            paid_at: input.paid_at,
            notes: input.notes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id,year,month" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["employee-salaries", year, month] });
      toast.success("Employee salary saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save salary."),
  });
}

export async function runPaymentReminders(): Promise<{ sent: number; skipped: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("send-payment-reminders", { body: {} });
  if (error) {
    const bodyError =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error ?? "")
        : "";
    return { sent: 0, skipped: 0, error: bodyError || error.message };
  }
  const sent = Number((data as { sent?: number })?.sent ?? 0);
  const skipped = Number((data as { skipped?: number })?.skipped ?? 0);
  return { sent, skipped };
}
