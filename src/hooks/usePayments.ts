import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PAYMENT_STATUS, type PaymentStatus } from "@/lib/constants";

// New tables may not be in generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface StudentPaymentRow {
  id?: string;
  student_id: string;
  year: number;
  month: number;
  amount: number;
  status: PaymentStatus | string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
  student_name?: string;
  student_email?: string;
  student_status?: string;
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

export function useStudentPayments(year: number, month: number) {
  return useQuery({
    queryKey: ["student-payments", year, month],
    queryFn: async (): Promise<StudentPaymentRow[]> => {
      const { data: students, error: stuErr } = await supabase
        .from("students")
        .select(
          "id, name, email, status, payment_amount, payment_status, payment_method, payment_date, payment_notes",
        )
        .order("name");
      if (stuErr) throw stuErr;

      const { data: payments, error: payErr } = await db
        .from("student_payments")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      if (payErr) throw payErr;

      const byStudent = new Map(
        ((payments ?? []) as { student_id: string }[]).map((p) => [
          p.student_id,
          p as Record<string, unknown>,
        ]),
      );

      return (students ?? []).map((s) => {
        const existing = byStudent.get(s.id);
        if (existing) {
          return {
            id: String(existing.id),
            student_id: s.id,
            year,
            month,
            amount: Number(existing.amount ?? 0),
            status: String(existing.status ?? DEFAULT_PAYMENT_STATUS),
            payment_method: String(existing.payment_method ?? ""),
            paid_at: (existing.paid_at as string | null) ?? null,
            notes: String(existing.notes ?? ""),
            student_name: s.name,
            student_email: s.email,
            student_status: s.status,
          };
        }
        return {
          student_id: s.id,
          year,
          month,
          amount: Number(s.payment_amount ?? 0),
          status: String(s.payment_status ?? DEFAULT_PAYMENT_STATUS),
          payment_method: String(s.payment_method ?? ""),
          paid_at: (s.payment_date as string | null) ?? null,
          notes: String(s.payment_notes ?? ""),
          student_name: s.name,
          student_email: s.email,
          student_status: s.status,
        };
      });
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

export function useUpsertStudentPayment(year: number, month: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { student_id: string } & PaymentSave) => {
      const { data, error } = await db
        .from("student_payments")
        .upsert(
          {
            student_id: input.student_id,
            year,
            month,
            amount: input.amount,
            status: input.status,
            payment_method: input.payment_method,
            paid_at: input.paid_at,
            notes: input.notes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,year,month" },
        )
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("students")
        .update({
          payment_amount: input.amount,
          payment_status: input.status,
          payment_method: input.payment_method,
          payment_date: input.paid_at,
          payment_notes: input.notes,
        })
        .eq("id", input.student_id);

      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-payments", year, month] });
      void qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student payment saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save payment."),
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
