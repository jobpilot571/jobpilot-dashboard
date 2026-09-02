import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppStatusMenu } from "@/components/applications/AppStatusMenu";
import {
  useAddJobApplication,
  useDeleteJobApplication,
  useJobApplications,
  useUpdateJobApplication,
  useUploadApplicationResume,
  type JobApplication,
} from "@/hooks/useJobApplications";
import {
  useStudentPipelineEvents,
  useUpsertPipelineEvent,
  type PipelineEvent,
} from "@/hooks/usePlacement";
import {
  FORWARD_STAGES,
  STAGE_STATUS_OPTIONS,
  appForwardNote,
  parseAppIdFromForwardNote,
  type ForwardStageKey,
} from "@/features/placement/constants";
import { autofillFromJobLink, JOB_LINK_GUIDANCE } from "@/lib/jobLinkAutofill";
import { enrichJobLinkWithAi } from "@/lib/parseJobLinkAi";
import { groupAppHistory, type HistoryBucket } from "@/lib/appHistoryGroups";
import {
  APPLICATION_SOURCES,
  DEFAULT_APPLICATION_SOURCE,
  detectApplicationSource,
  emptySourceCounts,
  isApplicationSource,
  type ApplicationSource,
} from "@/lib/applicationSources";
import { getNowCST, getTodayCST, formatTimeCST } from "@/lib/timezone";
import { cn } from "@/lib/utils";

function appSource(app: JobApplication): ApplicationSource {
  return isApplicationSource(app.application_source)
    ? app.application_source
    : DEFAULT_APPLICATION_SOURCE;
}

export function StudentJobApplicationsTab({
  studentId,
  employeeId,
}: {
  studentId: string;
  employeeId?: string | null;
}) {
  const today = getTodayCST();
  const now = getNowCST();
  const { data: apps = [], isLoading, isError, error } = useJobApplications(studentId);
  const { data: pipeline = [] } = useStudentPipelineEvents(studentId);
  const add = useAddJobApplication(studentId);
  const update = useUpdateJobApplication(studentId);
  const remove = useDeleteJobApplication(studentId);
  const uploadResume = useUploadApplicationResume(studentId);
  const upsertPipeline = useUpsertPipelineEvent();

  const [source, setSource] = useState<ApplicationSource>(DEFAULT_APPLICATION_SOURCE);
  const [draftOpen, setDraftOpen] = useState(true);
  const [link, setLink] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("applied");
  const [draftStage, setDraftStage] = useState<ForwardStageKey | "">("");
  const [autofilling, setAutofilling] = useState(false);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [historyBucket, setHistoryBucket] = useState<HistoryBucket>("daily");
  const [expandedHistoryKey, setExpandedHistoryKey] = useState<string | null>(null);

  const sectionApps = useMemo(
    () => apps.filter((a) => appSource(a) === source),
    [apps, source],
  );

  const todaySourceCounts = useMemo(() => {
    const map = emptySourceCounts();
    for (const a of apps) {
      if (a.applied_date === today) map[appSource(a)] += 1;
    }
    return map;
  }, [apps, today]);

  const todayTotal = useMemo(
    () => APPLICATION_SOURCES.reduce((sum, s) => sum + todaySourceCounts[s.value], 0),
    [todaySourceCounts],
  );

  const todayApps = useMemo(() => {
    const list = sectionApps.filter((a) => a.applied_date === today);
    return [...list].sort((a, b) => {
      if (b.serial_no !== a.serial_no) return b.serial_no - a.serial_no;
      return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime();
    });
  }, [sectionApps, today]);

  const historyGroups = useMemo(
    () => groupAppHistory(sectionApps, historyBucket, today),
    [sectionApps, historyBucket, today],
  );

  const pastCount = useMemo(
    () => sectionApps.filter((a) => a.applied_date !== today).length,
    [sectionApps, today],
  );

  const todayCount = todayApps.length;

  const stageByAppId = useMemo(() => {
    const map: Record<string, PipelineEvent> = {};
    const rank: Record<string, number> = {
      panel: 5,
      technical: 4,
      screening: 3,
      ai_screening: 2,
      assessment: 1,
    };
    for (const e of pipeline) {
      const appId = parseAppIdFromForwardNote(e.notes);
      if (!appId) continue;
      const prev = map[appId];
      if (!prev || (rank[e.stage] ?? 0) >= (rank[prev.stage] ?? 0)) map[appId] = e;
    }
    return map;
  }, [pipeline]);

  const runAutofill = async (raw: string, opts?: { forceAi?: boolean }) => {
    const url = raw.trim();
    if (!url) return;
    const detected = detectApplicationSource(url, source);
    const switched = detected !== source;
    if (switched) setSource(detected);
    setAutofilling(true);
    setAutofillNote(null);
    const sectionNote = switched
      ? `Switched to ${APPLICATION_SOURCES.find((s) => s.value === detected)?.label}. `
      : "";
    try {
      const local = autofillFromJobLink(url);
      if (local.company) setCompany(local.company);
      // Clear path junk (e.g. OpportunityApply) when URL has no real title
      if (local.jobRole) setRole(local.jobRole);
      else if (local.needsPageFetch) setRole("");

      const needDeep =
        opts?.forceAi ||
        local.needsPageFetch ||
        local.confidence !== "high" ||
        !local.company ||
        !local.jobRole;

      if (needDeep) {
        const enriched = await enrichJobLinkWithAi(url);
        if (enriched) {
          if (enriched.company) setCompany(enriched.company);
          if (enriched.jobRole) setRole(enriched.jobRole);
          if (enriched.jobRole) {
            setAutofillNote(
              sectionNote +
                (enriched.source === "page"
                  ? "Filled from job posting page."
                  : enriched.source === "ai"
                    ? "Filled via AI link parse."
                    : "Filled from URL."),
            );
          } else if (enriched.company) {
            setAutofillNote(
              `${sectionNote}Company: ${enriched.company}. Job role isn’t in this URL (often login-gated) — type it manually.`,
            );
          } else {
            setAutofillNote(`${sectionNote}Could not autofill — enter company & role manually.`);
          }
        } else {
          setAutofillNote(`${sectionNote}Could not autofill role — enter company & role manually.`);
        }
        if (local.warnings[0]) toast.message(local.warnings[0]);
      } else {
        setAutofillNote(sectionNote ? `${sectionNote}Filled from URL.` : "Filled from URL.");
      }
    } finally {
      setAutofilling(false);
    }
  };

  const applyForwardStage = async (app: JobApplication, stage: ForwardStageKey) => {
    try {
      if (app.status !== "forwarded") {
        await update.mutateAsync({ id: app.id, updates: { status: "forwarded" } });
      }
      const existingSameStage = pipeline.find(
        (e) => parseAppIdFromForwardNote(e.notes) === app.id && e.stage === stage,
      );
      if (existingSameStage) {
        toast.message(`Already on ${FORWARD_STAGES.find((s) => s.key === stage)?.label}.`);
        return;
      }
      const defaultStatus = STAGE_STATUS_OPTIONS[stage][0] ?? "Pending";
      await upsertPipeline.mutateAsync({
        student_id: studentId,
        employee_id: employeeId ?? null,
        stage,
        company_name: app.company_name || null,
        job_role: app.job_role || null,
        event_link: app.applied_link || null,
        event_date: getTodayCST(),
        document_url: app.resume_file_url || null,
        status: defaultStatus,
        notes: appForwardNote(app.id),
      });
      toast.success(`Forwarded to ${FORWARD_STAGES.find((s) => s.key === stage)?.label}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set forward stage.");
    }
  };

  const saveDraft = () => {
    if (!link.trim()) return;
    if (status === "forwarded" && !draftStage) {
      toast.error("Choose Forwarded → Assessment, Screening, Technical, or Panel.");
      return;
    }
    add.mutate(
      {
        applied_link: link.trim(),
        job_role: role.trim(),
        company_name: company.trim(),
        status,
        created_by_employee_id: employeeId ?? null,
        applied_date: now.date,
        applied_time: now.time,
        application_source: detectApplicationSource(link, source),
      },
      {
        onSuccess: async (created) => {
          if (status === "forwarded" && draftStage && created?.id) {
            await applyForwardStage(created as JobApplication, draftStage);
          }
          setLink("");
          setRole("");
          setCompany("");
          setStatus("applied");
          setDraftStage("");
          setAutofillNote(null);
        },
      },
    );
  };

  const activeSourceLabel =
    APPLICATION_SOURCES.find((s) => s.value === source)?.label ?? "Career sites";

  return (
    <div className="space-y-8">
      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load applications: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {APPLICATION_SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setSource(s.value);
                setExpandedHistoryKey(null);
                setDraftOpen(true);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                source === s.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  source === s.value ? "bg-white/20" : "bg-muted text-muted-foreground",
                )}
              >
                {todaySourceCounts[s.value]}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto shrink-0 rounded-lg bg-muted/80 px-3 py-2 text-sm font-semibold tabular-nums text-foreground">
          Total = {todayTotal}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">
              Today&apos;s Applications · {activeSourceLabel}
            </h3>
            <Badge className="border-border bg-muted text-muted-foreground">{todayCount} saved</Badge>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setDraftOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Log {activeSourceLabel} links here. Paste a URL to autofill; LinkedIn / Dice / Jobright links switch
          section automatically. {JOB_LINK_GUIDANCE}
        </p>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2 font-medium">Sl</th>
                <th className="w-[6.5rem] px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Applied Link</th>
                <th className="w-[16%] px-2 py-2 font-medium">Job Role</th>
                <th className="w-[14%] px-2 py-2 font-medium">Company</th>
                <th className="w-[5.5rem] px-2 py-2 font-medium">Time</th>
                <th className="w-[7rem] px-2 py-2 font-medium">Resume</th>
                <th className="w-[8rem] px-2 py-2 font-medium">Status</th>
                <th className="w-16 px-1 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {draftOpen ? (
                <tr className="border-b border-border bg-sky-50/80">
                  <td className="px-3 py-2 text-xs font-semibold text-sky-700">New</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{today}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <Input
                          className="h-8"
                          placeholder="Paste job posting URL…"
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          onBlur={() => {
                            if (link.trim()) void runAutofill(link);
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (text) {
                              setTimeout(() => void runAutofill(text), 0);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          title="Autofill company & role from link"
                          disabled={autofilling || !link.trim()}
                          onClick={() => void runAutofill(link, { forceAi: true })}
                        >
                          {autofilling ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      {autofillNote ? (
                        <p className="text-[10px] text-muted-foreground">{autofillNote}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8"
                      placeholder="Job role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="h-8"
                      placeholder="Company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{now.time}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">After save</td>
                  <td className="px-3 py-2">
                    <AppStatusMenu
                      status={status}
                      forwardStage={draftStage}
                      onSelectStatus={(next) => {
                        setStatus(next);
                        setDraftStage("");
                      }}
                      onSelectForwardStage={(stage) => {
                        setStatus("forwarded");
                        setDraftStage(stage);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8"
                        disabled={add.isPending || !link.trim() || !status}
                        onClick={saveDraft}
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDraftOpen(false)}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : null}

              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-3 py-2">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : todayApps.map((a) => (
                    <AppTableRow
                      key={a.id}
                      a={a}
                      fwdStage={(stageByAppId[a.id]?.stage as ForwardStageKey | undefined) ?? ""}
                      update={update}
                      remove={remove}
                      uploadResume={uploadResume}
                      applyForwardStage={applyForwardStage}
                    />
                  ))}
              {!isLoading && todayApps.length === 0 && !draftOpen ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    No {activeSourceLabel} applications logged today. Click Add Row, or open history below.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold">
            Job Applications History · {activeSourceLabel}
          </h3>
          <Badge className="border-border bg-muted text-muted-foreground">{pastCount} past</Badge>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {(
            [
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["yearly", "Yearly"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setHistoryBucket(id);
                setExpandedHistoryKey(null);
              }}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition",
                historyBucket === id
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : historyGroups.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No previous {activeSourceLabel} applications yet.
            </p>
          ) : (
            historyGroups.map((g) => {
              const open = expandedHistoryKey === g.key;
              return (
                <div key={g.key} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    onClick={() => setExpandedHistoryKey(open ? null : g.key)}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="flex-1 font-medium text-foreground">{g.label}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">{g.count} apps</span>
                  </button>
                  {open ? (
                    <div className="overflow-x-auto border-t border-border bg-muted/20">
                      <table className="w-full table-fixed text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Sl</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Applied Link</th>
                            <th className="px-3 py-2 font-medium">Job Role</th>
                            <th className="px-3 py-2 font-medium">Company</th>
                            <th className="px-3 py-2 font-medium">Time</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...g.apps]
                            .sort((a, b) => b.serial_no - a.serial_no)
                            .map((a) => (
                              <tr key={a.id} className="border-t border-border/60">
                                <td className="px-3 py-2 tabular-nums">{a.serial_no > 0 ? a.serial_no : "—"}</td>
                                <td className="px-3 py-2 tabular-nums">{a.applied_date}</td>
                                <td className="px-3 py-2">
                                  {a.applied_link ? (
                                    <a
                                      href={a.applied_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex max-w-[260px] items-center gap-1 truncate text-primary hover:underline"
                                    >
                                      {a.applied_link.replace(/^https?:\/\//, "").slice(0, 40)}…
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-2">{a.job_role || "—"}</td>
                                <td className="px-3 py-2">{a.company_name || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {a.applied_time || (a.applied_at ? formatTimeCST(a.applied_at) : "—")}
                                </td>
                                <td className="px-3 py-2 capitalize">{a.status || "—"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function AppTableRow({
  a,
  fwdStage,
  update,
  remove,
  uploadResume,
  applyForwardStage,
}: {
  a: JobApplication;
  fwdStage: ForwardStageKey | "";
  update: ReturnType<typeof useUpdateJobApplication>;
  remove: ReturnType<typeof useDeleteJobApplication>;
  uploadResume: ReturnType<typeof useUploadApplicationResume>;
  applyForwardStage: (app: JobApplication, stage: ForwardStageKey) => Promise<void>;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-3 py-2.5 tabular-nums font-medium text-foreground">
        {a.serial_no > 0 ? a.serial_no : "—"}
      </td>
      <td className="px-3 py-2.5 tabular-nums">{a.applied_date}</td>
      <td className="px-3 py-2.5">
        {a.applied_link ? (
          <a
            href={a.applied_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[220px] items-center gap-1 truncate text-primary hover:underline"
          >
            {a.applied_link.replace(/^https?:\/\//, "").slice(0, 36)}…
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5">{a.job_role || "—"}</td>
      <td className="px-3 py-2.5">{a.company_name || "—"}</td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {a.applied_time || (a.applied_at ? formatTimeCST(a.applied_at) : "—")}
      </td>
      <td className="px-3 py-2.5">
        <ResumeCell
          app={a}
          uploading={uploadResume.isPending}
          onUpload={(file) => uploadResume.mutate({ applicationId: a.id, file })}
        />
      </td>
      <td className="relative px-3 py-2.5">
        <AppStatusMenu
          status={a.status}
          forwardStage={a.status === "forwarded" ? fwdStage : ""}
          onSelectStatus={(next) => {
            void update.mutateAsync({ id: a.id, updates: { status: next } });
          }}
          onSelectForwardStage={(stage) => {
            void applyForwardStage(a, stage);
          }}
        />
      </td>
      <td className="px-3 py-2.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => {
            if (confirm("Delete this application?")) remove.mutate(a.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function ResumeCell({
  app,
  uploading,
  onUpload,
}: {
  app: JobApplication;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      {app.resume_file_url ? (
        <a
          href={app.resume_file_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-primary hover:underline"
          title="Open resume"
        >
          <Upload className="h-4 w-4" />
        </a>
      ) : null}
      <button
        type="button"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          !app.resume_file_url && "text-primary",
        )}
        title={app.resume_file_url ? "Replace resume" : "Upload resume for this application"}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
