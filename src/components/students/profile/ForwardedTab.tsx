import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  Forward,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FORWARD_STAGES,
  STAGE_STATUS_OPTIONS,
  buildForwardNotes,
  companyLogoUrl,
  nextForwardRounds,
  parseAppIdFromForwardNote,
  parseJdFromNotes,
  type ForwardStageKey,
} from "@/features/placement/constants";
import { useJobApplications } from "@/hooks/useJobApplications";
import {
  useDeletePipelineEvent,
  useStudentPipelineEvents,
  useUploadPipelineScreenshot,
  useUpsertPipelineEvent,
  type PipelineEvent,
} from "@/hooks/usePlacement";
import { getTodayCST, formatDateCST, formatTimeCST } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const STAGE_TONE: Record<ForwardStageKey, string> = {
  assessment: "border-sky-200 bg-sky-50 text-sky-800",
  ai_screening: "border-violet-200 bg-violet-50 text-violet-900",
  screening: "border-indigo-200 bg-indigo-50 text-indigo-900",
  technical: "border-amber-200 bg-amber-50 text-amber-900",
  panel: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StudentForwardedTab({
  studentId,
  employeeId,
  canDelete = true,
  canAdd = true,
}: {
  studentId: string;
  employeeId?: string | null;
  /** Employees/admins can delete; students cannot. */
  canDelete?: boolean;
  canAdd?: boolean;
}) {
  const { data: events = [], isLoading } = useStudentPipelineEvents(studentId);
  const { data: apps = [] } = useJobApplications(studentId);
  const remove = useDeletePipelineEvent();
  const upsert = useUpsertPipelineEvent();
  const uploadShot = useUploadPipelineScreenshot();
  const [filter, setFilter] = useState<"all" | ForwardStageKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(canAdd);

  const [stage, setStage] = useState<ForwardStageKey>("screening");
  const [link, setLink] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [fwdDate, setFwdDate] = useState(getTodayCST());
  const [jd, setJd] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const shotInputRef = useRef<HTMLInputElement>(null);

  const appsById = useMemo(() => Object.fromEntries(apps.map((a) => [a.id, a])), [apps]);

  useEffect(() => {
    if (filter !== "all") setStage(filter);
  }, [filter]);

  const counts = useMemo(() => {
    const c: Record<ForwardStageKey, number> = {
      assessment: 0,
      ai_screening: 0,
      screening: 0,
      technical: 0,
      panel: 0,
    };
    for (const e of events) {
      if (e.stage in c) c[e.stage as ForwardStageKey] += 1;
    }
    return c;
  }, [events]);

  const rows = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.stage === filter)),
    [events, filter],
  );

  const resetForm = () => {
    setLink("");
    setCompany("");
    setRole("");
    setFwdDate(getTodayCST());
    setJd("");
    setScreenshotFile(null);
    if (shotInputRef.current) shotInputRef.current.value = "";
  };

  const submitNew = async () => {
    if (!link.trim()) {
      toast.error("Application link is required.");
      return;
    }
    setSaving(true);
    try {
      const created = await upsert.mutateAsync({
        student_id: studentId,
        employee_id: employeeId ?? null,
        stage,
        company_name: company.trim() || null,
        job_role: role.trim() || null,
        event_link: link.trim(),
        event_date: fwdDate || getTodayCST(),
        status: STAGE_STATUS_OPTIONS[stage][0] ?? "Pending",
        notes: buildForwardNotes(null, jd),
      });
      if (screenshotFile && created?.id) {
        await uploadShot.mutateAsync({
          eventId: created.id,
          studentId,
          file: screenshotFile,
        });
      }
      toast.success(`Saved to ${FORWARD_STAGES.find((s) => s.key === stage)?.label}.`);
      resetForm();
      setExpandedId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save forwarded application.");
    } finally {
      setSaving(false);
    }
  };

  const advanceToRound = async (source: PipelineEvent, next: ForwardStageKey) => {
    const appId = parseAppIdFromForwardNote(source.notes);
    const already = events.some(
      (e) => e.stage === next && parseAppIdFromForwardNote(e.notes) === appId && appId,
    );
    if (already) {
      toast.message(`Already has a ${FORWARD_STAGES.find((s) => s.key === next)?.label} entry.`);
      return;
    }
    try {
      const linked = appId ? appsById[appId] : undefined;
      await upsert.mutateAsync({
        student_id: studentId,
        employee_id: employeeId ?? source.employee_id,
        stage: next,
        company_name: source.company_name,
        job_role: source.job_role,
        event_link: source.event_link || linked?.applied_link || null,
        event_date: getTodayCST(),
        document_url: source.document_url || linked?.resume_file_url || null,
        status: STAGE_STATUS_OPTIONS[next][0] ?? "Scheduled",
        notes: buildForwardNotes(appId, parseJdFromNotes(source.notes)),
      });
      toast.success(`Added to ${FORWARD_STAGES.find((s) => s.key === next)?.label}. Original row kept.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to advance round.");
    }
  };

  const saveRow = async (
    event: PipelineEvent,
    patch: { event_link?: string; event_date?: string; jd?: string },
  ) => {
    const appId = parseAppIdFromForwardNote(event.notes);
    try {
      await upsert.mutateAsync({
        id: event.id,
        student_id: event.student_id,
        stage: event.stage as ForwardStageKey,
        event_link: patch.event_link !== undefined ? patch.event_link : event.event_link,
        event_date: patch.event_date !== undefined ? patch.event_date : event.event_date,
        notes: patch.jd !== undefined ? buildForwardNotes(appId, patch.jd) : event.notes,
      });
      toast.success("Forwarded details saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Forward className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold">Forwarded</h3>
          <Badge className="border-border bg-muted text-muted-foreground">{events.length} total</Badge>
        </div>
        {canAdd ? (
          <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add forwarded
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FORWARD_STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter((f) => (f === s.key ? "all" : s.key))}
            className={cn(
              "rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md",
              filter === s.key ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{counts[s.key]}</p>
          </button>
        ))}
      </div>

      {canAdd && formOpen ? (
        <Card className="border-primary/30 bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Add forwarded application</CardTitle>
            <CardDescription>
              Enter the application link, forwarded date, and upload a screenshot of the forwarded email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Stage
                </label>
                <Select
                  className="h-9"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as ForwardStageKey)}
                >
                  {FORWARD_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Forwarded date
                </label>
                <Input type="date" className="h-9" value={fwdDate} onChange={(e) => setFwdDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Company
                </label>
                <Input
                  className="h-9"
                  placeholder="Company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Job role
                </label>
                <Input
                  className="h-9"
                  placeholder="Job role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Application link *
              </label>
              <Input
                className="h-9"
                placeholder="https://… job posting or application URL"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Screenshot of forwarded email
              </label>
              <input
                ref={shotInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.pdf"
                className="hidden"
                onChange={(e) => {
                  setScreenshotFile(e.target.files?.[0] ?? null);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => shotInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {screenshotFile ? "Change screenshot" : "Choose screenshot"}
                </Button>
                {screenshotFile ? (
                  <span className="text-xs text-muted-foreground">{screenshotFile.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional — you can add it later too</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Job description (optional)
              </label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste JD…"
                className="min-h-[80px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={saving || !link.trim()} onClick={() => void submitNew()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Submit forwarded
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-base">
            {filter === "all" ? "All forwarded stages" : FORWARD_STAGES.find((s) => s.key === filter)?.label}
          </CardTitle>
          <CardDescription>
            Expand a row to edit link, date, screenshot, JD, or move to the next round.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 sm:p-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : rows.length === 0 ? (
            <div className="space-y-3 px-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No forwarded rows in this stage yet.
                {canAdd ? (
                  <>
                    {" "}
                    Use <strong>Add forwarded</strong> above to submit an application link, date, and
                    screenshot.
                  </>
                ) : null}
              </p>
              {canAdd && !formOpen ? (
                <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add forwarded
                </Button>
              ) : null}
            </div>
          ) : (
            rows.map((e) => {
              const appId = parseAppIdFromForwardNote(e.notes);
              const linked = appId ? appsById[appId] : undefined;
              return (
                <ForwardExpandableRow
                  key={e.id}
                  event={e}
                  expanded={expandedId === e.id}
                  onToggle={() => setExpandedId((id) => (id === e.id ? null : e.id))}
                  appliedAt={linked?.applied_at ?? linked?.applied_date}
                  resumeUrl={e.document_url || linked?.resume_file_url || null}
                  defaultLink={e.event_link || linked?.applied_link || ""}
                  onSave={(patch) => void saveRow(e, patch)}
                  onUploadScreenshot={(file) => {
                    uploadShot.mutate(
                      { eventId: e.id, studentId, file },
                      {
                        onSuccess: () => toast.success("Screenshot uploaded."),
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Upload failed."),
                      },
                    );
                  }}
                  uploadingShot={uploadShot.isPending}
                  onAdvance={(next) => void advanceToRound(e, next)}
                  canDelete={canDelete}
                  onDelete={() => {
                    if (confirm("Delete this forwarded event?")) remove.mutate(e.id);
                  }}
                />
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ForwardExpandableRow({
  event,
  expanded,
  onToggle,
  appliedAt,
  resumeUrl,
  defaultLink,
  onSave,
  onUploadScreenshot,
  uploadingShot,
  onAdvance,
  canDelete,
  onDelete,
}: {
  event: PipelineEvent;
  expanded: boolean;
  onToggle: () => void;
  appliedAt?: string | null;
  resumeUrl: string | null;
  defaultLink: string;
  onSave: (patch: { event_link?: string; event_date?: string; jd?: string }) => void;
  onUploadScreenshot: (file: File) => void;
  uploadingShot: boolean;
  onAdvance: (stage: ForwardStageKey) => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const stage = event.stage as ForwardStageKey;
  const label = FORWARD_STAGES.find((s) => s.key === stage)?.label ?? event.stage;
  const [jd, setJd] = useState(() => parseJdFromNotes(event.notes));
  const [link, setLink] = useState(defaultLink);
  const [fwdDate, setFwdDate] = useState(event.event_date || event.created_at.slice(0, 10));
  const logo = companyLogoUrl(event.company_name, event.event_link || defaultLink);
  const nextRounds = nextForwardRounds(stage);
  const shotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) {
      setJd(parseJdFromNotes(event.notes));
      setLink(event.event_link || defaultLink || "");
      setFwdDate(event.event_date || event.created_at.slice(0, 10));
    }
  }, [expanded, event.id, event.notes, event.event_link, event.event_date, event.created_at, defaultLink]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card transition",
        expanded && "ring-2 ring-primary/15",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40 sm:px-4"
      >
        <img
          src={logo}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display font-semibold text-foreground">
              {event.company_name || "Unknown company"}
            </p>
            <Badge className={cn("border", STAGE_TONE[stage] ?? STAGE_TONE.assessment)}>{label}</Badge>
            {event.status ? <span className="text-xs text-muted-foreground">{event.status}</span> : null}
            {event.screenshot_url ? (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Screenshot</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {event.job_role || "No role"} · Forwarded {event.event_date || formatDateCST(event.created_at)}
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-border bg-muted/20 px-3 py-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaChip
              icon={CalendarDays}
              label="Applied"
              value={
                appliedAt
                  ? appliedAt.includes("T")
                    ? `${formatDateCST(appliedAt)} · ${formatTimeCST(appliedAt)}`
                    : appliedAt
                  : "—"
              }
            />
            <div className="space-y-1.5 rounded-lg border border-border bg-card px-3 py-2">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Forwarded date
              </label>
              <Input
                type="date"
                className="h-8"
                value={fwdDate}
                onChange={(e) => setFwdDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Application link
            </label>
            <div className="flex gap-2">
              <Input
                className="h-9"
                placeholder="https://… job posting or application URL"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              {link.trim() ? (
                <a
                  href={link.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-medium text-primary hover:bg-muted"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" /> Screenshot of forwarded email
            </label>
            <input
              ref={shotRef}
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadScreenshot(file);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploadingShot}
                onClick={() => shotRef.current?.click()}
              >
                {uploadingShot ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {event.screenshot_url ? "Replace screenshot" : "Upload screenshot"}
              </Button>
              {event.screenshot_url ? (
                <a
                  href={event.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  View screenshot <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No screenshot yet</span>
              )}
            </div>
            {event.screenshot_url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(event.screenshot_url) ? (
              <a href={event.screenshot_url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={event.screenshot_url}
                  alt="Forwarded email screenshot"
                  className="mt-1 max-h-48 rounded-lg border border-border bg-white object-contain"
                />
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {resumeUrl ? (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" /> Resume from application
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" /> No resume on this application
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Job description
            </label>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              className="min-h-[120px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onSave({ event_link: link.trim(), event_date: fwdDate, jd })}
            >
              Save details
            </Button>
          </div>

          {nextRounds.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Move to next round
              </p>
              <div className="flex flex-wrap gap-2">
                {nextRounds.map((key) => (
                  <Button key={key} type="button" size="sm" variant="outline" onClick={() => onAdvance(key)}>
                    + {FORWARD_STAGES.find((s) => s.key === key)?.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">This is the final interview round (Panel).</p>
          )}

          <div className="flex justify-end border-t border-border pt-3">
            {canDelete ? (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete this row
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only your counselor or admin can delete forwarded rows.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}
