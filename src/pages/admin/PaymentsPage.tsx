import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DollarSign, GraduationCap, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/dialog";
import {
  runPaymentReminders,
  useEmployeeSalaries,
  useStudentBilling,
  useUpsertEmployeeSalary,
  useUpsertStudentBilling,
  type EmployeeSalaryRow,
  type StudentBillingRow,
} from "@/hooks/usePayments";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/constants";
import { livePaymentStatus, nextPayDateAfter } from "@/lib/billing";
import { formatRosterDate, getTodayCST } from "@/lib/timezone";
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
  next_pay_date: string;
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

function toStuDraft(row: StudentBillingRow): StuDraft {
  return {
    rate: String(row.rate ?? 0),
    status: row.status || "unpaid",
    payment_method: row.payment_method || "",
    paid_at: row.paid_at || "",
    next_pay_date: row.next_pay_date || "",
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
              Admin-only billing: rate, how they paid, paid date, and next pay date. Start date comes from
              Students and cannot be edited here.
            </p>
          </div>
          {tab === "employees" ? (
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
          ) : (
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
          )}
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
          <StudentsBillingTable search={search} showInactive={showInactive} />
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

function StudentsBillingTable({
  search,
  showInactive,
}: {
  search: string;
  showInactive: boolean;
}) {
  const { data = [], isLoading, isError, error } = useStudentBilling();
  const save = useUpsertStudentBilling();
  const [drafts, setDrafts] = useState<Record<string, StuDraft>>({});

  useEffect(() => {
    const next: Record<string, StuDraft> = {};
    for (const row of data) next[row.student_id] = toStuDraft(row);
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
      <p className="text-xs text-muted-foreground">
        After a payment is recorded, status stays <span className="font-medium text-foreground">paid</span> until
        the next pay date, then flips to unpaid automatically. Reminder emails go out once a day starting 5 days
        before the next pay date (when an admin opens Students).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Student</th>
              <th className="px-3 py-2.5 font-medium">Start date</th>
              <th className="px-3 py-2.5 font-medium">Rate plan</th>
              <th className="px-3 py-2.5 font-medium">Payment status</th>
              <th className="px-3 py-2.5 font-medium">How paid</th>
              <th className="px-3 py-2.5 font-medium">Paid date</th>
              <th className="px-3 py-2.5 font-medium">Next pay date</th>
              <th className="px-3 py-2.5 font-medium">Note</th>
              <th className="px-3 py-2.5 font-medium">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No students match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row.student_id;
                const draft = drafts[id] ?? toStuDraft(row);
                const live = livePaymentStatus({
                  payment_status: draft.status,
                  next_pay_date: draft.next_pay_date || null,
                  payment_date: draft.paid_at || null,
                  joining_date: row.start_date,
                });
                return (
                  <tr key={id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.student_name}</p>
                      <p className="text-xs text-muted-foreground">{row.student_email}</p>
                      {row.student_status === "inactive" ? (
                        <Badge className="mt-1 border-destructive/30 bg-destructive/10 text-destructive">
                          Inactive
                        </Badge>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatRosterDate(row.start_date)}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-[110px] tabular-nums"
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
                    <td className="px-3 py-2">
                      <Select
                        className="h-8 w-[120px]"
                        value={draft.status === "partial" ? "unpaid" : draft.status}
                        onChange={(e) => {
                          const status = e.target.value;
                          setDrafts((prev) => {
                            const next = { ...draft, status };
                            if (status === "paid") {
                              const paid = next.paid_at || getTodayCST();
                              next.paid_at = paid;
                              next.next_pay_date = nextPayDateAfter(paid, row.start_date);
                            }
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
                      <Badge className={cn("mt-1 capitalize", statusTone(live))}>{live}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <MethodSelect
                        value={draft.payment_method}
                        onChange={(payment_method) =>
                          setDrafts((prev) => ({ ...prev, [id]: { ...draft, payment_method } }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-[140px]"
                        type="date"
                        value={draft.paid_at}
                        onChange={(e) => {
                          const paid_at = e.target.value;
                          setDrafts((prev) => ({
                            ...prev,
                            [id]: {
                              ...draft,
                              paid_at,
                              next_pay_date: paid_at
                                ? nextPayDateAfter(paid_at, row.start_date)
                                : draft.next_pay_date,
                            },
                          }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-[140px]"
                        type="date"
                        value={draft.next_pay_date}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [id]: { ...draft, next_pay_date: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 min-w-[140px]"
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
                        disabled={save.isPending && save.variables?.student_id === id}
                        onClick={() => {
                          void save.mutateAsync({
                            student_id: id,
                            rate: Number(draft.rate) || 0,
                            status: draft.status,
                            payment_method: draft.payment_method.trim(),
                            paid_at: draft.paid_at || null,
                            next_pay_date: draft.next_pay_date || null,
                            notes: draft.notes.trim(),
                          });
                        }}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {save.isPending && save.variables?.student_id === id ? "Saving…" : "Save"}
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
          Start date is read-only. Record a payment here; Students only shows paid vs unpaid.
        </div>
      </div>
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
    <>
      <Select
        className="h-8 w-[140px]"
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
        <Input className="mt-1 h-8 w-[140px]" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : null}
    </>
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
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Employee</th>
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
                No employees match this filter.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = row.employee_id;
              const draft = drafts[id] ?? toEmpDraft(row);
              return (
                <tr key={id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{row.employee_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.employee_email ?? ""}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-[120px] tabular-nums"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amount}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, amount: e.target.value } }))
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
                    <MethodSelect
                      value={draft.payment_method}
                      onChange={(payment_method) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, payment_method } }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 w-[140px]"
                      type="date"
                      value={draft.paid_at}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, paid_at: e.target.value } }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8 min-w-[160px]"
                      placeholder="Notes"
                      value={draft.notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [id]: { ...draft, notes: e.target.value } }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Button type="button" size="sm" disabled={savingId === id} onClick={() => onSave(id)}>
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
    </div>
  );
}
