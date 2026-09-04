import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { getInitials } from "@/features/employees/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FORWARD_STAGES,
  STAGE_COLUMN_TONE,
  STAGE_ORDER,
  STAGE_TONE,
  buildForwardNotes,
  companyLogoUrl,
  liveCardsFromEvents,
  normalizeStage,
  parseAppIdFromForwardNote,
  parseJdFromNotes,
  placementStageLabel,
  type ForwardStageKey,
} from "@/features/placement/constants";
import { useAuth } from "@/contexts/AuthContext";
import {
  useJobApplicationIndex,
  useJobApplications,
} from "@/hooks/useJobApplications";
import {
  useDeletePipelineEvent,
  usePipelineEvents,
  useStudentPipelineEvents,
  useUploadPipelineScreenshot,
  useUpsertPipelineEvent,
  type PipelineEvent,
} from "@/hooks/usePlacement";
import { useStudents } from "@/hooks/useStudents";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { getTodayCST, formatDateCST, formatTimeCST } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export function PlacementBoard({
  studentId,
  employeeId,
  showStudentName = false,
  compactHeader = false,
}: {
  studentId?: string;
  employeeId?: string | null;
  showStudentName?: boolean;
  compactHeader?: boolean;
}) {
  const { role } = useAuth();
  const canDelete = role === "admin";
  const canAdd = true;
  const scoped = !!studentId;

  const { data: scopedEvents = [], isLoading: scopedLoading } = useStudentPipelineEvents(studentId);
  const { data: allEvents = [], isLoading: allLoading } = usePipelineEvents(!scoped);
  const events = scoped ? scopedEvents : allEvents;
  const isLoading = scoped ? scopedLoading : allLoading;

  const { data: scopedApps = [] } = useJobApplications(studentId);
  const { data: indexedApps = [] } = useJobApplicationIndex(!scoped);
  const apps = scoped ? scopedApps : indexedApps;
  const { data: students = [] } = useStudents();
  const { data: currentEmployee } = useCurrentEmployee();
  const ownerEmployeeId = employeeId ?? currentEmployee?.id ?? null;
  const remove = useDeletePipelineEvent();
  const upsert = useUpsertPipelineEvent();
  const uploadShot = useUploadPipelineScreenshot();

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<ForwardStageKey>("assessment");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [stage, setStage] = useState<ForwardStageKey>("assessment");
  const [formStudentId, setFormStudentId] = useState(studentId ?? "");
  const [link, setLink] = useState("");
  const [company, setCompany] = useState("");
  const [roleName, setRoleName] = useState("");
  const [fwdDate, setFwdDate] = useState(getTodayCST());
  const [jd, setJd] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const shotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (studentId) setFormStudentId(studentId);
  }, [studentId]);

  const appsById = useMemo(() => Object.fromEntries(apps.map((a) => [a.id, a])), [apps]);
  const studentsById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  const cards = useMemo(() => {
    const live = liveCardsFromEvents(events);
    const q = search.trim().toLowerCase();
    if (!q) return live;
    return live.filter((e) => {
      const student = studentsById[e.student_id];
      const hay = [e.company_name, e.job_role, e.event_link, student?.name, student?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, search, studentsById]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((k) => [k, [] as PipelineEvent[]])) as Record<
      ForwardStageKey,
      PipelineEvent[]
    >;
    for (const e of cards) {
      map[normalizeStage(e.stage)].push(e);
    }
    return map;
  }, [cards]);

  const stageCards = byStage[bucket];

  const studentGroups = useMemo(() => {
    const map = new Map<string, PipelineEvent[]>();
    for (const e of stageCards) {
      const list = map.get(e.student_id) ?? [];
      list.push(e);
      map.set(e.student_id, list);
    }
    return Array.from(map.entries())
      .map(([id, items]) => ({
        studentId: id,
        student: studentsById[id],
        cards: items,
      }))
      .sort((a, b) => (a.student?.name ?? "Unknown").localeCompare(b.student?.name ?? "Unknown"));
  }, [stageCards, studentsById]);

  const selectBucket = (key: ForwardStageKey) => {
    setBucket(key);
    setStage(key);
    setExpandedStudentId(null);
    setExpandedId(null);
  };

  const resetForm = () => {
    setLink("");
    setCompany("");
    setRoleName("");
    setFwdDate(getTodayCST());
    setJd("");
    setScreenshotFile(null);
    setStage("assessment");
    if (!studentId) setFormStudentId("");
    if (shotInputRef.current) shotInputRef.current.value = "";
  };

  const submitNew = async () => {
    const sid = (studentId || formStudentId).trim();
    if (!sid) {
      toast.error("Choose a student.");
      return;
    }
    if (!link.trim()) {
      toast.error("Application link is required.");
      return;
    }
    setSaving(true);
    try {
      const created = await upsert.mutateAsync({
        student_id: sid,
        employee_id: ownerEmployeeId,
        stage,
        company_name: company.trim() || null,
        job_role: roleName.trim() || null,
        event_link: link.trim(),
        event_date: fwdDate || getTodayCST(),
        status: placementStageLabel(stage),
        notes: buildForwardNotes(null, jd),
      });
      if (screenshotFile && created?.id) {
        await uploadShot.mutateAsync({
          eventId: created.id,
          studentId: sid,
          file: screenshotFile,
        });
      }
      toast.success(`Added to ${placementStageLabel(stage)}.`);
      resetForm();
      setFormOpen(false);
      setBucket(stage);
      setExpandedStudentId(sid);
      setExpandedId(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save forwarded application.");
    } finally {
      setSaving(false);
    }
  };

  const moveCard = async (event: PipelineEvent, next: ForwardStageKey) => {
    if (normalizeStage(event.stage) === next) return;
    try {
      await upsert.mutateAsync({
        id: event.id,
        student_id: event.student_id,
        stage: next,
        event_date: getTodayCST(),
        status: placementStageLabel(next),
      });
      toast.success(`Moved to ${placementStageLabel(next)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move card.");
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
        stage: normalizeStage(event.stage),
        event_link: patch.event_link !== undefined ? patch.event_link : event.event_link,
        event_date: patch.event_date !== undefined ? patch.event_date : event.event_date,
        notes: patch.jd !== undefined ? buildForwardNotes(appId, patch.jd) : event.notes,
      });
      toast.success("Details saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  const renderCard = (e: PipelineEvent, showName?: boolean) => {
    const appId = parseAppIdFromForwardNote(e.notes);
    const linked = appId ? appsById[appId] : undefined;
    const student = studentsById[e.student_id];
    const linkedResume = linked?.resume_file_url || null;
    const isOffer = normalizeStage(e.stage) === "offer";
    const offerLetterUrl =
      isOffer && e.document_url && e.document_url !== linkedResume ? e.document_url : null;
    return (
      <PipelineCard
        key={e.id}
        event={e}
        expanded={expandedId === e.id}
        onToggle={() => setExpandedId((id) => (id === e.id ? null : e.id))}
        studentName={showName ? student?.name : undefined}
        appliedAt={linked?.applied_at ?? linked?.applied_date}
        resumeUrl={linkedResume || (!isOffer ? e.document_url : null)}
        offerLetterUrl={offerLetterUrl}
        defaultLink={e.event_link || linked?.applied_link || ""}
        onSave={(patch) => void saveRow(e, patch)}
        onMove={(next) => void moveCard(e, next)}
        onUploadScreenshot={(file, field) => {
          uploadShot.mutate(
            { eventId: e.id, studentId: e.student_id, file, field },
            {
              onSuccess: () =>
                toast.success(field === "document_url" ? "Offer letter uploaded." : "Screenshot uploaded."),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed."),
            },
          );
        }}
        uploadingShot={uploadShot.isPending}
        canDelete={canDelete}
        onDelete={() => {
          if (confirm("Delete this placement card? Only admins can do this.")) {
            remove.mutate(e.id, {
              onSuccess: () => toast.success("Card deleted."),
              onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
            });
          }
        }}
      />
    );
  };

  return (
    <div className="space-y-4">
      {!compactHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Input
              className="h-9 max-w-sm"
              placeholder={showStudentName ? "Search company, role, or student" : "Search company or role"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Badge className="border-border bg-muted text-muted-foreground">{cards.length} cards</Badge>
          </div>
          {canAdd ? (
            <Button type="button" size="sm" onClick={() => setFormOpen((o) => !o)}>
              <Plus className="h-3.5 w-3.5" />
              Add forwarded
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex justify-end">
          {canAdd ? (
            <Button type="button" size="sm" onClick={() => setFormOpen((o) => !o)}>
              <Plus className="h-3.5 w-3.5" />
              Add forwarded
            </Button>
          ) : null}
        </div>
      )}

      {canAdd && formOpen ? (
        <Card className="border-primary/30 bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Add forwarded application</CardTitle>
            <CardDescription>
              Application start stays on the Apps log. Here, add the forwarded date and a screenshot of
              the forwarded email. Changing status later moves this card into the next bucket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {!scoped ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Student *
                  </label>
                  <Select
                    className="h-9"
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                  >
                    <option value="">Select student…</option>
                    {students
                      .filter((s) => s.status !== "inactive")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Status
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
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
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
                onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => shotInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {screenshotFile ? "Change screenshot" : "Choose screenshot"}
                </Button>
                {screenshotFile ? (
                  <span className="text-xs text-muted-foreground">{screenshotFile.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Optional — you can add it later</span>
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
              <Button
                type="button"
                size="sm"
                disabled={saving || !link.trim() || !(studentId || formStudentId)}
                onClick={() => void submitNew()}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Submit forwarded
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        {FORWARD_STAGES.map((s) => {
          const selected = bucket === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => selectBucket(s.key)}
              className={cn(
                "rounded-xl border p-3 text-left shadow-sm transition",
                selected
                  ? cn("ring-2 ring-primary/30", STAGE_COLUMN_TONE[s.key])
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums">{byStage[s.key].length}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <Card className={cn("border", STAGE_COLUMN_TONE[bucket])}>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">
              {placementStageLabel(bucket)}
            </CardTitle>
            <CardDescription>
              {scoped || !showStudentName
                ? `${stageCards.length} card${stageCards.length === 1 ? "" : "s"} in this bucket.`
                : `${studentGroups.length} student${studentGroups.length === 1 ? "" : "s"} · ${stageCards.length} card${stageCards.length === 1 ? "" : "s"}. Click a student to see their cards.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stageCards.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                No applications in {placementStageLabel(bucket)} yet.
              </p>
            ) : scoped || !showStudentName ? (
              <div className="space-y-2">{stageCards.map((e) => renderCard(e))}</div>
            ) : (
              studentGroups.map((group) => {
                const open = expandedStudentId === group.studentId;
                const name = group.student?.name || "Unknown student";
                const email = group.student?.email || "";
                return (
                  <div
                    key={group.studentId}
                    className={cn(
                      "overflow-hidden rounded-xl border border-border bg-card",
                      open && "ring-2 ring-primary/15",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStudentId((id) => (id === group.studentId ? null : group.studentId))
                      }
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40 sm:px-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-semibold text-foreground">{name}</p>
                        {email ? (
                          <p className="truncate text-xs text-muted-foreground">{email}</p>
                        ) : null}
                      </div>
                      <Badge className="border-border bg-muted tabular-nums text-muted-foreground">
                        {group.cards.length} {group.cards.length === 1 ? "card" : "cards"}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-border bg-muted/20 p-3 sm:p-4">
                        {group.cards.map((e) => renderCard(e))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PipelineCard({
  event,
  expanded,
  onToggle,
  studentName,
  appliedAt,
  resumeUrl,
  offerLetterUrl,
  defaultLink,
  onSave,
  onMove,
  onUploadScreenshot,
  uploadingShot,
  canDelete,
  onDelete,
}: {
  event: PipelineEvent;
  expanded: boolean;
  onToggle: () => void;
  studentName?: string;
  appliedAt?: string | null;
  resumeUrl: string | null;
  offerLetterUrl: string | null;
  defaultLink: string;
  onSave: (patch: { event_link?: string; event_date?: string; jd?: string }) => void;
  onMove: (stage: ForwardStageKey) => void;
  onUploadScreenshot: (file: File, field?: "screenshot_url" | "document_url") => void;
  uploadingShot: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const stage = normalizeStage(event.stage);
  const label = placementStageLabel(stage);
  const [jd, setJd] = useState(() => parseJdFromNotes(event.notes));
  const [link, setLink] = useState(defaultLink);
  const [fwdDate, setFwdDate] = useState(event.event_date || event.created_at.slice(0, 10));
  const logo = companyLogoUrl(event.company_name, event.event_link || defaultLink);
  const shotRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) {
      setJd(parseJdFromNotes(event.notes));
      setLink(event.event_link || defaultLink || "");
      setFwdDate(event.event_date || event.created_at.slice(0, 10));
    }
  }, [expanded, event.id, event.notes, event.event_link, event.event_date, event.created_at, defaultLink]);

  const appliedLabel = appliedAt
    ? appliedAt.includes("T")
      ? `${formatDateCST(appliedAt)} · ${formatTimeCST(appliedAt)}`
      : appliedAt
    : "—";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm transition",
        expanded && "ring-2 ring-primary/15",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
      >
        <img
          src={logo}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md border border-border bg-white object-contain p-0.5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="min-w-0 flex-1 sm:max-w-[28%]">
          {studentName ? (
            <p className="truncate text-[11px] font-medium text-muted-foreground">{studentName}</p>
          ) : null}
          <p className="truncate text-sm font-semibold text-foreground">{event.company_name || "Unknown company"}</p>
          <p className="truncate text-xs text-muted-foreground">{event.job_role || "No role"}</p>
        </div>
        <div className="hidden min-w-[7.5rem] shrink-0 sm:block">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Applied</p>
          <p className="text-xs font-medium tabular-nums text-foreground">
            {appliedLabel === "—" ? "—" : appliedAt?.slice(0, 10) ?? appliedLabel}
          </p>
        </div>
        <div className="hidden min-w-[7.5rem] shrink-0 md:block">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Forwarded</p>
          <p className="text-xs font-medium tabular-nums text-foreground">
            {event.event_date || formatDateCST(event.created_at)}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Badge className={cn("border text-[10px]", STAGE_TONE[stage])}>{label}</Badge>
          {event.screenshot_url ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">Shot</Badge>
          ) : null}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border bg-muted/15 px-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[11rem_minmax(0,1fr)]">
            {event.screenshot_url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(event.screenshot_url) ? (
              <a href={event.screenshot_url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={event.screenshot_url}
                  alt="Forwarded email screenshot"
                  className="h-28 w-full rounded-lg border border-border bg-white object-contain"
                />
              </a>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-card text-xs text-muted-foreground">
                No screenshot
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Application status
                </label>
                <Select
                  className="h-8"
                  value={stage}
                  onChange={(e) => onMove(e.target.value as ForwardStageKey)}
                >
                  {FORWARD_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <MetaChip icon={CalendarDays} label="Application start" value={appliedLabel} />
              <div className="space-y-1 rounded-lg border border-border bg-card px-2.5 py-2">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Forwarded date
                </label>
                <Input type="date" className="h-8" value={fwdDate} onChange={(e) => setFwdDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Application link
                </label>
                <div className="flex gap-1.5">
                  <Input
                    className="h-8"
                    placeholder="https://…"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  />
                  {link.trim() ? (
                    <a
                      href={link.trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-card px-2 text-xs text-primary hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Changing status moves this card to that bucket.</p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={shotRef}
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadScreenshot(file, "screenshot_url");
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadingShot}
              onClick={() => shotRef.current?.click()}
            >
              {uploadingShot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {event.screenshot_url ? "Replace screenshot" : "Upload screenshot"}
            </Button>
            {event.screenshot_url ? (
              <a
                href={event.screenshot_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary hover:underline"
              >
                View screenshot
              </a>
            ) : null}

            {stage === "offer" ? (
              <>
                <input
                  ref={letterRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadScreenshot(file, "document_url");
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingShot}
                  onClick={() => letterRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {offerLetterUrl ? "Replace letter" : "Upload letter"}
                </Button>
                {offerLetterUrl ? (
                  <a
                    href={offerLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View letter
                  </a>
                ) : null}
              </>
            ) : null}

            {resumeUrl && resumeUrl !== offerLetterUrl ? (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
              >
                <Upload className="h-3 w-3" /> Resume
              </a>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Job description
            </label>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste JD…"
              className="min-h-[72px] w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canDelete ? (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete card
              </Button>
            ) : (
              <p className="mr-auto text-[11px] text-muted-foreground">Only an admin can delete cards.</p>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => onSave({ event_link: link.trim(), event_date: fwdDate, jd })}
            >
              Save details
            </Button>
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
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-primary" />
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}
