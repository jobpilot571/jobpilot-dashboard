import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ClipboardList, DollarSign, GraduationCap, History, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  runPaymentReminders,
  useEmployeeSalaries,
  useStudentMonthPayments,
  useStudentPaymentHistory,
  useStudentPaymentRecords,
  useUpsertEmployeeSalary,
  useUpsertStudentMonthPayment,
  type EmployeeSalaryRow,
  type StudentMonthRow,
  type StudentPaymentRecord,
} from "@/hooks/usePayments";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/constants";
import { formatRosterDate, getTodayCST } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Tab = "students" | "employees" | "records";

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

function payPeriodLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year} pay`;
}

function statusTone(status: string) {
  if (status === "paid") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
  if (status === "waived" || status === "n/a") return "border-sky-500/30 bg-sky-500/10 text-sky-800";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

type EmpDraft = {
  amount: string;
  status: string;
  payment_method: string;
  paid_at: string;
  notes: string;
};

type StuDraft = {
  rate: string;
  status: string;
  payment_method: string;
  paid_at: string;
  notes: string;
};

function toEmpDraft(row: {
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  notes: string;
}): EmpDraft {
  return {
    amount: String(row.amount ?? 0),
    status: row.status || "unpaid",
    payment_method: row.payment_method || "",
    paid_at: row.paid_at || "",
    notes: row.notes || "",
  };
}

function toStuDraft(row: StudentMonthRow): StuDraft {
  return {
    rate: String(row.rate ?? 0),
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
  const [reminding, setReminding] = useState(false);
  const [recordsAllMonths, setRecordsAllMonths] = useState(true);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = today.year + 1; y >= today.year - 4; y -= 1) list.push(y);
    return list;
  }, [today.year]);

  return (
    <AppShell role="admin">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Finance</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Active students only. Each month is saved as its own payment record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === "records" ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={recordsAllMonths}
                  onChange={(e) => setRecordsAllMonths(e.target.checked)}
                />
                All months
              </label>
            ) : null}
            <Select
              className="w-[140px]"
              value={String(month)}
              disabled={tab === "records" && recordsAllMonths}
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
            {tab === "students" ? (
              <Button
                type="button"
                variant="outline"
                disabled={reminding}
                onClick={() => {
                  setReminding(true);
                  void runPaymentReminders()
                    .then((r) => {
                      if (r.error) throw new Error(r.error);
                      if (r.sent > 0) {
                        toast.success(`Sent ${r.sent} payment reminder${r.sent === 1 ? "" : "s"}.`);
                      } else {
                        toast.message("No reminders due today (or already sent).");
                      }
                    })
                    .catch((err: Error) => {
                      toast.error(err.message || "Reminder send failed.");
                    })
                    .finally(() => setReminding(false));
                }}
              >
                {reminding ? "Sending…" : "Send due reminders"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            {(
              [
                ["students", "Students", GraduationCap],
                ["employees", "Employees", Users],
                ["records", "Records", ClipboardList],
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
          {tab === "employees" ? (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          ) : null}
        </div>

        {tab === "students" ? (
          <StudentsBillingTable year={year} month={month} search={search} />
        ) : tab === "employees" ? (
          <EmployeesSalariesTable
            year={year}
            month={month}
            search={search}
            showInactive={showInactive}
          />
        ) : (
          <PaymentRecordsTable
            year={year}
            month={month}
            allMonths={recordsAllMonths}
            search={search}
          />
        )}
      </div>
    </AppShell>
  );
}

function StudentsBillingTable({
  year,
  month,
  search,
}: {
  year: number;
  month: number;
  search: string;
}) {
  const { data = [], isLoading, isError, error } = useStudentMonthPayments(year, month);
  const save = useUpsertStudentMonthPayment(year, month);
  const [drafts, setDrafts] = useState<Record<string, StuDraft>>({});
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const next: Record<string, StuDraft> = {};
    for (const row of data) next[row.student_id] = toStuDraft(row);
    setDrafts(next);
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (!q) return true;
      return (
        (r.student_name || "").toLowerCase().includes(q) ||
        (r.student_email || "").toLowerCase().includes(q)
      );
    });
  }, [data, search]);

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
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{payPeriodLabel(year, month)}</h2>
        <p className="text-xs text-muted-foreground">
          Save each row to keep a record for this month. Open Records to review every saved month.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-[18%] px-2 py-2 font-medium">Student</th>
              <th className="w-[7.5rem] px-1.5 py-2 font-medium">Start date</th>
              <th className="w-[5.5rem] px-1.5 py-2 font-medium">Rate</th>
              <th className="w-[6.5rem] px-1.5 py-2 font-medium">Status</th>
              <th className="w-[7rem] px-1.5 py-2 font-medium">How paid</th>
              <th className="w-[7.25rem] px-1.5 py-2 font-medium">Paid date</th>
              <th className="px-1.5 py-2 font-medium">Note</th>
              <th className="w-20 px-1 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  No active students match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row.student_id;
                const draft = drafts[id] ?? toStuDraft(row);
                const saving = save.isPending && save.variables?.student_id === id;
                return (
                  <tr key={id} className="border-b border-border/70 last:border-0">
                    <td className="min-w-0 px-2 py-1.5">
                      <p className="truncate font-medium text-foreground">{row.student_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{row.student_email}</p>
                      {row.recorded ? (
                        <p className="text-[10px] font-medium text-emerald-700">Recorded this month</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Not recorded yet</p>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-xs tabular-nums text-muted-foreground">
                      {formatRosterDate(row.start_date)}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        className="h-8 w-full min-w-0 px-1.5 tabular-nums text-xs"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.rate}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [id]: { ...draft, rate: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Select
                        className="h-8 w-full min-w-0 px-1.5 text-xs"
                        value={draft.status === "partial" ? "unpaid" : draft.status}
                        onChange={(e) => {
                          const status = e.target.value;
                          setDrafts((prev) => {
                            const next = { ...draft, status };
                            if (status === "paid" && !next.paid_at) next.paid_at = getTodayCST();
                            return { ...prev, [id]: next };
                          });
                        }}
                      >
                        {PAYMENT_STATUSES.filter((s) => s !== "partial").map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-1.5 py-1.5">
                      <MethodSelect
                        value={draft.payment_method}
                        onChange={(payment_method) =>
                          setDrafts((prev) => ({ ...prev, [id]: { ...draft, payment_method } }))
                        }
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        className="h-8 w-full min-w-0 px-1 text-xs"
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
                    <td className="px-1.5 py-1.5">
                      <Input
                        className="h-8 w-full min-w-0 px-1.5 text-xs"
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
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Payment history"
                          aria-label="Payment history"
                          onClick={() => setHistoryStudent({ id, name: row.student_name })}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          className="h-8 w-8"
                          title={saving ? "Saving…" : "Save this month"}
                          aria-label="Save this month"
                          disabled={saving}
                          onClick={() => {
                            void save.mutateAsync({
                              student_id: id,
                              start_date: row.start_date,
                              rate: Number(draft.rate) || 0,
                              status: draft.status,
                              payment_method: draft.payment_method.trim(),
                              paid_at: draft.paid_at || null,
                              notes: draft.notes.trim(),
                            });
                          }}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          {payPeriodLabel(year, month)} · start date is read-only
        </div>
      </div>
      <StudentMonthHistoryDialog
        studentId={historyStudent?.id ?? null}
        studentName={historyStudent?.name ?? ""}
        open={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </div>
  );
}

function MethodSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const listed = PAYMENT_METHODS.includes(value as (typeof PAYMENT_METHODS)[number]);
  return (
    <div className="min-w-0">
      <Select
        className="h-8 w-full min-w-0 px-1.5 text-xs"
        value={listed ? value : value ? "__custom__" : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "__custom__" ? value || "Other" : v);
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
      {!listed && value ? (
        <Input
          className="mt-1 h-8 w-full min-w-0 px-1.5 text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

function PaymentRecordsTable({
  year,
  month,
  allMonths,
  search,
}: {
  year: number;
  month: number;
  allMonths: boolean;
  search: string;
}) {
  const { data = [], isLoading, isError, error } = useStudentPaymentRecords();
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string } | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (!allMonths && (r.year !== year || r.month !== month)) return false;
      if (!q) return true;
      return (
        r.student_name.toLowerCase().includes(q) ||
        r.student_email.toLowerCase().includes(q)
      );
    });
  }, [data, search, allMonths, year, month]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load payment records."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {allMonths ? "All payment records" : payPeriodLabel(year, month)}
        </h2>
        <p className="text-xs text-muted-foreground">
          Every saved monthly payment. Use the clock icon to see one student’s full history.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-[9rem] px-2 py-2 font-medium">Month</th>
              <th className="w-[22%] px-2 py-2 font-medium">Student</th>
              <th className="w-[5.5rem] px-1.5 py-2 font-medium">Amount</th>
              <th className="w-[6.5rem] px-1.5 py-2 font-medium">Status</th>
              <th className="w-[8rem] px-1.5 py-2 font-medium">How paid</th>
              <th className="w-[7.5rem] px-1.5 py-2 font-medium">Paid date</th>
              <th className="px-1.5 py-2 font-medium">Note</th>
              <th className="w-10 px-1 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  No payment records yet. Save a month on the Students tab to create one.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.student_id}-${row.year}-${row.month}-${row.id ?? ""}`} className="border-b border-border/70 last:border-0">
                  <td className="px-2 py-1.5 text-xs font-medium">{payPeriodLabel(row.year, row.month)}</td>
                  <td className="min-w-0 px-2 py-1.5">
                    <p className="truncate font-medium">{row.student_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.student_email}</p>
                  </td>
                  <td className="px-1.5 py-1.5 text-xs tabular-nums">${Number(row.amount || 0).toFixed(2)}</td>
                  <td className="px-1.5 py-1.5">
                    <Badge className={cn("capitalize", statusTone(row.status))}>{row.status}</Badge>
                  </td>
                  <td className="truncate px-1.5 py-1.5 text-xs">{row.payment_method || "—"}</td>
                  <td className="px-1.5 py-1.5 text-xs tabular-nums">{formatRosterDate(row.paid_at)}</td>
                  <td className="truncate px-1.5 py-1.5 text-xs text-muted-foreground">{row.notes || "—"}</td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Student history"
                      aria-label="Student history"
                      onClick={() => setHistoryStudent({ id: row.student_id, name: row.student_name })}
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <StudentMonthHistoryDialog
        studentId={historyStudent?.id ?? null}
        studentName={historyStudent?.name ?? ""}
        open={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </div>
  );
}

function StudentMonthHistoryDialog({
  studentId,
  studentName,
  open,
  onClose,
}: {
  studentId: string | null;
  studentName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data = [], isLoading, isError, error } = useStudentPaymentHistory(open ? studentId : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Payment history"
      description={studentName ? `Monthly records for ${studentName}` : undefined}
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load history."}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No monthly payment records yet for this student.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[28%] px-2 py-2 font-medium">Month</th>
                <th className="w-[18%] px-2 py-2 font-medium">Amount</th>
                <th className="w-[18%] px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">How / when</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: StudentPaymentRecord) => (
                <tr key={`${row.year}-${row.month}-${row.id ?? ""}`} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-2 text-xs font-medium">{payPeriodLabel(row.year, row.month)}</td>
                  <td className="px-2 py-2 text-xs tabular-nums">${Number(row.amount || 0).toFixed(2)}</td>
                  <td className="px-2 py-2">
                    <Badge className={cn("capitalize", statusTone(row.status))}>{row.status}</Badge>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {row.payment_method || "—"}
                    {row.paid_at ? ` · ${formatRosterDate(row.paid_at)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
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
  const [drafts, setDrafts] = useState<Record<string, EmpDraft>>({});

  useEffect(() => {
    const next: Record<string, EmpDraft> = {};
    for (const row of data) next[row.employee_id] = toEmpDraft(row);
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
      const d = drafts[r.employee_id] ?? toEmpDraft(r);
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
      <h2 className="font-display text-lg font-semibold tracking-tight">{payPeriodLabel(year, month)}</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge className="border-border bg-muted text-muted-foreground">{totals.count} employees</Badge>
        <Badge className="border-border bg-muted text-muted-foreground">
          Payroll ${totals.due.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800">
          Paid ${totals.paid.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Badge>
      </div>
      <EmployeeTable
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

function EmployeeTable({
  rows,
  drafts,
  setDrafts,
  savingId,
  onSave,
}: {
  rows: EmployeeSalaryRow[];
  drafts: Record<string, EmpDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, EmpDraft>>>;
  savingId: string;
  onSave: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-[22%] px-2 py-2 font-medium">Employee</th>
            <th className="w-[6.5rem] px-1.5 py-2 font-medium">Amount</th>
            <th className="w-[6.5rem] px-1.5 py-2 font-medium">Paid?</th>
            <th className="w-[8rem] px-1.5 py-2 font-medium">How paid</th>
            <th className="w-[7.25rem] px-1.5 py-2 font-medium">Paid date</th>
            <th className="px-1.5 py-2 font-medium">Notes</th>
            <th className="w-10 px-1 py-2 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                No employees match this filter.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = row.employee_id;
              const draft = drafts[id] ?? toEmpDraft(row);
              return (
                <tr key={id} className="border-b border-border/70 last:border-0">
                  <td className="min-w-0 px-2 py-1.5">
                    <p className="truncate font-medium text-foreground">{row.employee_name ?? "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.employee_email ?? ""}</p>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      className="h-8 w-full min-w-0 px-1.5 tabular-nums text-xs"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, amount: e.target.value } }))
                      }
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Select
                      className="h-8 w-full min-w-0 px-1.5 text-xs"
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
                  </td>
                  <td className="px-1.5 py-1.5">
                    <MethodSelect
                      value={draft.payment_method}
                      onChange={(payment_method) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, payment_method } }))
                      }
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      className="h-8 w-full min-w-0 px-1 text-xs"
                      type="date"
                      value={draft.paid_at}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, paid_at: e.target.value } }))
                      }
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      className="h-8 w-full min-w-0 px-1.5 text-xs"
                      placeholder="Notes"
                      value={draft.notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, notes: e.target.value } }))
                      }
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8"
                      title={savingId === id ? "Saving…" : "Save"}
                      aria-label="Save salary"
                      disabled={savingId === id}
                      onClick={() => onSave(id)}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
