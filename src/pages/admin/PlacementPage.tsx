import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageHistoryDialog } from "@/components/placement/StageHistoryDialog";
import { useEmployees } from "@/hooks/useEmployees";
import {
  usePipelineEvents,
  usePlacementSummary,
  usePlacementTotals,
} from "@/hooks/usePlacement";
import {
  healthFromActivity,
  STAGE_META,
  STAGE_STATUS_OPTIONS,
  type PipelineStage,
} from "@/features/placement/constants";
import {
  Briefcase,
  GraduationCap,
  Target,
  Users,
} from "lucide-react";

export default function AdminPlacementPage() {
  const { data: employees = [] } = useEmployees();
  const { data: events = [] } = usePipelineEvents();
  const { data: summary = [], isLoading, isError, error, refetch } = usePlacementSummary();
  const { data: totals } = usePlacementTotals();

  const [search, setSearch] = useState("");
  const [empFilter, setEmpFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [historyStudentName, setHistoryStudentName] = useState("");
  const [historyStage, setHistoryStage] = useState<PipelineStage>("assessment");

  const eventStatusesByStudent = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const e of events) {
      if (!e.status && !e.result) continue;
      (m[e.student_id] ??= new Set()).add(e.status || e.result || "");
    }
    return m;
  }, [events]);

  const rows = useMemo(() => {
    return summary
      .filter((r) => {
        if (!r.student_id) return false;
        if (empFilter !== "all" && r.assigned_employee_id !== empFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.student_name.toLowerCase().includes(q) &&
            !r.student_email.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (stageFilter !== "all") {
          const countKey = `${stageFilter}_count` as keyof typeof r;
          if (!(r[countKey] as number)) return false;
        }
        if (dateFrom && (!r.last_pipeline_at || r.last_pipeline_at.slice(0, 10) < dateFrom)) return false;
        if (dateTo && (!r.last_pipeline_at || r.last_pipeline_at.slice(0, 10) > dateTo)) return false;
        if (statusFilter !== "all" && !eventStatusesByStudent[r.student_id]?.has(statusFilter)) return false;
        return true;
      })
      .map((r) => {
        const counts: Record<PipelineStage, number> = {
          assessment: r.assessment_count,
          ai_screening: 0,
          screening: r.screening_count,
          technical: r.technical_count,
          panel: r.panel_count,
          offer: r.offer_count,
        };
        const lastActivity = [r.last_pipeline_at, r.last_application_at]
          .filter(Boolean)
          .sort()
          .pop() as string | null;
        const health = healthFromActivity({
          interviewOffer: r.last_interview_offer_at,
          earlyStage: r.last_early_stage_at,
          any: lastActivity,
        });
        return { ...r, counts, lastActivity, health };
      });
  }, [summary, empFilter, search, stageFilter, dateFrom, dateTo, statusFilter, eventStatusesByStudent]);

  const openStage = (studentId: string, studentName: string, stage: PipelineStage) => {
    setHistoryStudentId(studentId);
    setHistoryStudentName(studentName);
    setHistoryStage(stage);
    setHistoryOpen(true);
  };

  const exportCsv = () => {
    const headers = [
      "Student",
      "Email",
      "Joined",
      "Employee",
      "Apps",
      "Assessment",
      "Screening",
      "Technical",
      "Panel",
      "Offer",
      "Status",
      "Last Activity",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.student_name,
          r.student_email,
          r.joined_date?.slice(0, 10) ?? "",
          r.employee_name ?? "",
          r.total_applications,
          r.counts.assessment,
          r.counts.screening,
          r.counts.technical,
          r.counts.panel,
          r.counts.offer,
          r.student_status ?? "",
          r.lastActivity?.slice(0, 10) ?? "",
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "placement-pipeline.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = totals ?? {
    apps: 0,
    activeStudents: 0,
    assessment: 0,
    screening: 0,
    technical: 0,
    panel: 0,
    offer: 0,
  };

  const allStatuses = Array.from(new Set(Object.values(STAGE_STATUS_OPTIONS).flat()));

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Placement</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pipeline by stage · DB keys unchanged · improved labels in UI
            </p>
          </div>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active students" value={t.activeStudents} icon={Users} />
          <StatCard label="Applications" value={t.apps} icon={Briefcase} tone="info" />
          <StatCard label="Interviews" value={t.screening + t.technical + t.panel} icon={Target} tone="warning" />
          <StatCard label="Offers" value={t.offer} icon={GraduationCap} tone="success" />
        </section>

        <section className="grid gap-3 sm:grid-cols-5">
          {STAGE_META.map((s) => (
            <div key={s.key} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.short}</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                {t[s.key as keyof typeof t] as number}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{s.label}</p>
            </div>
          ))}
        </section>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search student name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
              <option value="all">All employees</option>
              {employees
                .filter((e) => e.status !== "inactive")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </Select>
            <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">All stages</option>
              {STAGE_META.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Could not load placement summary</p>
            <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Student</th>
                  <th className="px-3 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium text-center">Apps</th>
                  {STAGE_META.map((s) => (
                    <th key={s.key} className="px-3 py-3 font-medium text-center" title={s.label}>
                      {s.short}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-3 py-3" colSpan={10}>
                          <Skeleton className="h-9 w-full" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                      No students match these filters.
                    </td>
                  </tr>
                ) : null}
                {rows.map((r) => (
                  <tr key={r.student_id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${r.health.color}`}
                          title={r.health.label}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.student_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.student_email}</p>
                          {r.has_needs_update ? (
                            <Badge className="mt-1 border-destructive/30 bg-destructive/10 text-destructive">
                              Needs update
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{r.employee_name || "Unassigned"}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                        {r.total_applications}
                      </span>
                    </td>
                    {STAGE_META.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          className="inline-flex min-w-[2rem] items-center justify-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                          title={`Open ${s.label} history`}
                          onClick={() => openStage(r.student_id, r.student_name, s.key)}
                        >
                          {r.counts[s.key]}
                        </button>
                        {s.key === "assessment" && r.has_overdue_assessment ? (
                          <div className="mt-1">
                            <Badge className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                              Overdue
                            </Badge>
                          </div>
                        ) : null}
                      </td>
                    ))}
                    <td className="px-3 py-3 capitalize text-muted-foreground">{r.student_status || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.lastActivity ? r.lastActivity.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <StageHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        studentId={historyStudentId}
        studentName={historyStudentName}
        stage={historyStage}
        events={events}
      />
    </AppShell>
  );
}
