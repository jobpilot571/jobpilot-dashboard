import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DollarSign, GraduationCap, Save, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/dialog";
import {
  useEmployeeSalaries,
  useStudentPayments,
  useUpsertEmployeeSalary,
  useUpsertStudentPayment,
  type EmployeeSalaryRow,
  type StudentPaymentRow,
} from "@/hooks/usePayments";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/constants";
import { getTodayCST } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Tab = "students" | "employees";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function periodFromToday() {
  const [y, m] = getTodayCST().split("-").map(Number);
  return { year: y, month: m };
}

function statusTone(status: string) {
  if (status === "paid") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
  if (status === "partial") return "border-amber-500/30 bg-amber-500/10 text-amber-800";
  if (status === "waived" || status === "n/a") return "border-sky-500/30 bg-sky-500/10 text-sky-800";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

type Draft = {
  amount: string;
  status: string;
  payment_method: string;
  paid_at: string;
  notes: string;
};

function toDraft(row: {
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
}): Draft {
  return {
    amount: String(row.amount ?? 0),
    status: row.status || "unpaid",
    payment_method: row.payment_method || "",
    paid_at: row.paid_at || "",
    notes: row.notes || "",
  };
}

export default function AdminPaymentsPage() {
  const today = periodFromToday();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [tab, setTab] = useState<Tab>("students");
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = today.year + 1; y >= today.year - 4; y -= 1) list.push(y);
    return list;
  }, [today.year]);

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Finance</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit each student&apos;s monthly payment and each employee&apos;s salary for the selected month.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="w-[140px]"
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
            <Select className="w-[100px]" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            {(
              [
                ["students", "Students", GraduationCap],
                ["employees", "Employees", Users],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  tab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <Input
            className="max-w-xs"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>

        {tab === "students" ? (
          <StudentsPaymentsTable
            year={year}
            month={month}
            search={search}
            showInactive={showInactive}
          />
        ) : (
          <EmployeesSalariesTable
            year={year}
            month={month}
            search={search}
            showInactive={showInactive}
          />
        )}
      </div>
    </AppShell>
  );
}

function StudentsPaymentsTable({
  year,
  month,
  search,
  showInactive,
}: {
  year: number;
  month: number;
  search: string;
  showInactive: boolean;
}) {
  const { data = [], isLoading, isError, error } = useStudentPayments(year, month);
  const save = useUpsertStudentPayment(year, month);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const row of data) next[row.student_id] = toDraft(row);
    setDrafts(next);
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (!showInactive && r.student_status === "inactive") return false;
      if (!q) return true;
      return (
        (r.student_name || "").toLowerCase().includes(q) ||
        (r.student_email || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, showInactive]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    for (const r of rows) {
      const d = drafts[r.student_id] ?? toDraft(r);
      const amt = Number(d.amount) || 0;
      due += amt;
      if (d.status === "paid") paid += amt;
    }
    return { due, paid, count: rows.length };
  }, [rows, drafts]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load student payments."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge className="border-border bg-muted text-muted-foreground">{totals.count} students</Badge>
        <Badge className="border-border bg-muted text-muted-foreground">
          Due ${totals.due.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800">
          Paid ${totals.paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
      </div>
      <PaymentTable
        kind="student"
        rows={rows}
        drafts={drafts}
        setDrafts={setDrafts}
        savingId={save.isPending ? String(save.variables?.student_id ?? "") : ""}
        onSave={(id) => {
          const d = drafts[id];
          if (!d) return;
          void save.mutateAsync({
            student_id: id,
            amount: Number(d.amount) || 0,
            status: d.status,
            payment_method: d.payment_method.trim(),
            paid_at: d.paid_at || null,
            notes: d.notes.trim(),
          });
        }}
      />
    </div>
  );
}

function EmployeesSalariesTable({
  year,
  month,
  search,
  showInactive,
}: {
  year: number;
  month: number;
  search: string;
  showInactive: boolean;
}) {
  const { data = [], isLoading, isError, error } = useEmployeeSalaries(year, month);
  const save = useUpsertEmployeeSalary(year, month);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const row of data) next[row.employee_id] = toDraft(row);
    setDrafts(next);
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (!showInactive && r.employee_status === "inactive") return false;
      if (!q) return true;
      return (
        (r.employee_name || "").toLowerCase().includes(q) ||
        (r.employee_email || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, showInactive]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    for (const r of rows) {
      const d = drafts[r.employee_id] ?? toDraft(r);
      const amt = Number(d.amount) || 0;
      due += amt;
      if (d.status === "paid") paid += amt;
    }
    return { due, paid, count: rows.length };
  }, [rows, drafts]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load employee salaries."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge className="border-border bg-muted text-muted-foreground">{totals.count} employees</Badge>
        <Badge className="border-border bg-muted text-muted-foreground">
          Payroll ${totals.due.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800">
          Paid ${totals.paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
      </div>
      <PaymentTable
        kind="employee"
        rows={rows}
        drafts={drafts}
        setDrafts={setDrafts}
        savingId={save.isPending ? String(save.variables?.employee_id ?? "") : ""}
        onSave={(id) => {
          const d = drafts[id];
          if (!d) return;
          void save.mutateAsync({
            employee_id: id,
            amount: Number(d.amount) || 0,
            status: d.status,
            payment_method: d.payment_method.trim(),
            paid_at: d.paid_at || null,
            notes: d.notes.trim(),
          });
        }}
      />
    </div>
  );
}

function getPersonFields(kind: "student" | "employee", row: StudentPaymentRow | EmployeeSalaryRow) {
  if (kind === "student") {
    const r = row as StudentPaymentRow;
    return {
      id: r.student_id,
      name: r.student_name ?? "—",
      email: r.student_email ?? "",
      personStatus: r.student_status ?? "",
    };
  }
  const r = row as EmployeeSalaryRow;
  return {
    id: r.employee_id,
    name: r.employee_name ?? "—",
    email: r.employee_email ?? "",
    personStatus: r.employee_status ?? "",
  };
}

function PaymentTable({
  kind,
  rows,
  drafts,
  setDrafts,
  savingId,
  onSave,
}: {
  kind: "student" | "employee";
  rows: StudentPaymentRow[] | EmployeeSalaryRow[];
  drafts: Record<string, Draft>;
  setDrafts: Dispatch<SetStateAction<Record<string, Draft>>>;
  savingId: string;
  onSave: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">{kind === "student" ? "Student" : "Employee"}</th>
            <th className="px-3 py-2.5 font-medium">Amount</th>
            <th className="px-3 py-2.5 font-medium">Paid?</th>
            <th className="px-3 py-2.5 font-medium">How paid</th>
            <th className="px-3 py-2.5 font-medium">Paid date</th>
            <th className="px-3 py-2.5 font-medium">Notes</th>
            <th className="px-3 py-2.5 font-medium">Save</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                No {kind === "student" ? "students" : "employees"} match this filter.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const person = getPersonFields(kind, row);
              const id = person.id;
              const draft = drafts[id] ?? toDraft(row);
              return (
                <tr key={id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.email}</p>
                    {person.personStatus === "inactive" ? (
                      <Badge className="mt-1 border-destructive/30 bg-destructive/10 text-destructive">
                        Inactive
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-[120px] tabular-nums"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: { ...draft, amount: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      className="h-8 w-[120px]"
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: { ...draft, status: e.target.value as PaymentStatus },
                        }))
                      }
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <Badge className={cn("mt-1 capitalize", statusTone(draft.status))}>{draft.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      className="h-8 w-[140px]"
                      value={
                        PAYMENT_METHODS.includes(draft.payment_method as (typeof PAYMENT_METHODS)[number])
                          ? draft.payment_method
                          : draft.payment_method
                            ? "__custom__"
                            : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: {
                            ...draft,
                            payment_method: v === "__custom__" ? draft.payment_method || "Other" : v,
                          },
                        }));
                      }}
                    >
                      <option value="">Select…</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </Select>
                    {!PAYMENT_METHODS.includes(draft.payment_method as (typeof PAYMENT_METHODS)[number]) &&
                    draft.payment_method ? (
                      <Input
                        className="mt-1 h-8 w-[140px]"
                        value={draft.payment_method}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [id]: { ...draft, payment_method: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-[140px]"
                      type="date"
                      value={draft.paid_at}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: { ...draft, paid_at: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 min-w-[160px]"
                      placeholder="Notes"
                      value={draft.notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [id]: { ...draft, notes: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingId === id}
                      onClick={() => onSave(id)}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingId === id ? "Saving…" : "Save"}
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5" />
        Amounts are per person for this month. Save each row after editing.
      </div>
    </div>
  );
}
