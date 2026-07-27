import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, Select } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  placementStageLabel,
  STAGE_STATUS_OPTIONS,
  type PipelineStage,
} from "@/features/placement/constants";
import { useUpsertPipelineEvent, type PipelineEvent } from "@/hooks/usePlacement";

type FormState = Partial<PipelineEvent> & { stage: PipelineStage; student_id: string };

export function PlacementEventDialog({
  open,
  onClose,
  studentId,
  stage,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  stage: PipelineStage;
  initial?: PipelineEvent | null;
}) {
  const upsert = useUpsertPipelineEvent();
  const [form, setForm] = useState<FormState>({ student_id: studentId, stage });

  useEffect(() => {
    if (!open) return;
    setForm({ student_id: studentId, stage, ...(initial ?? {}) });
  }, [open, studentId, stage, initial]);

  const set = <K extends keyof PipelineEvent>(key: K, value: PipelineEvent[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    try {
      await upsert.mutateAsync(form);
      toast.success(initial ? "Event updated." : "Event added.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={`${initial ? "Edit" : "Add"} — ${placementStageLabel(stage)}`}
      description="Stage keys stay the same in the database; only labels change in the UI."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={upsert.isPending} onClick={() => void save()}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company">
          <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
        </Field>
        <Field label="Job role">
          <Input value={form.job_role ?? ""} onChange={(e) => set("job_role", e.target.value)} />
        </Field>

        {stage === "assessment" ? (
          <>
            <Field label="Assessment link">
              <Input value={form.event_link ?? ""} onChange={(e) => set("event_link", e.target.value)} />
            </Field>
            <Field label="Date received">
              <Input type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} />
            </Field>
            <Field label="Completed">
              <Select
                value={form.completed ? "yes" : "no"}
                onChange={(e) => set("completed", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>
            <Field label="Result">
              <Select value={form.result ?? ""} onChange={(e) => set("result", e.target.value || null)}>
                <option value="">Select…</option>
                {STAGE_STATUS_OPTIONS.assessment.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        {stage === "screening" ? (
          <>
            <Field label="Recruiter name">
              <Input value={form.recruiter_name ?? ""} onChange={(e) => set("recruiter_name", e.target.value)} />
            </Field>
            <Field label="Recruiter email">
              <Input value={form.recruiter_email ?? ""} onChange={(e) => set("recruiter_email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone_number ?? ""} onChange={(e) => set("phone_number", e.target.value)} />
            </Field>
            <Field label="Date scheduled">
              <Input type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={form.event_time ?? ""} onChange={(e) => set("event_time", e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.status ?? ""} onChange={(e) => set("status", e.target.value || null)}>
                <option value="">Select…</option>
                {STAGE_STATUS_OPTIONS.screening.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        {stage === "technical" || stage === "panel" ? (
          <>
            <Field label="Interview date">
              <Input type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
            </Field>
            <Field label="Interview time">
              <Input type="time" value={form.event_time ?? ""} onChange={(e) => set("event_time", e.target.value)} />
            </Field>
            <Field label="Mode">
              <Select
                value={form.interview_mode ?? ""}
                onChange={(e) => set("interview_mode", e.target.value || null)}
              >
                <option value="">Select…</option>
                <option value="Phone">Phone</option>
                <option value="Video">Video</option>
                <option value="In Person">In Person</option>
              </Select>
            </Field>
            <Field label="Interview link">
              <Input value={form.event_link ?? ""} onChange={(e) => set("event_link", e.target.value)} />
            </Field>
            {stage === "technical" ? (
              <Field label="Interviewer">
                <Input
                  value={form.interviewer_name ?? ""}
                  onChange={(e) => set("interviewer_name", e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Panel members" className="sm:col-span-2">
                <Input
                  value={form.panel_members ?? ""}
                  onChange={(e) => set("panel_members", e.target.value)}
                  placeholder="Comma-separated names"
                />
              </Field>
            )}
            <Field label="Status">
              <Select value={form.status ?? ""} onChange={(e) => set("status", e.target.value || null)}>
                <option value="">Select…</option>
                {STAGE_STATUS_OPTIONS[stage].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        {stage === "offer" ? (
          <>
            <Field label="Salary / rate">
              <Input value={form.salary_or_rate ?? ""} onChange={(e) => set("salary_or_rate", e.target.value)} />
            </Field>
            <Field label="Employment type">
              <Input value={form.employment_type ?? ""} onChange={(e) => set("employment_type", e.target.value)} />
            </Field>
            <Field label="Offer date">
              <Input type="date" value={form.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
            </Field>
            <Field label="Joining date">
              <Input type="date" value={form.joining_date ?? ""} onChange={(e) => set("joining_date", e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={form.status ?? ""} onChange={(e) => set("status", e.target.value || null)}>
                <option value="">Select…</option>
                {STAGE_STATUS_OPTIONS.offer.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        <Field label="Notes" className="sm:col-span-2">
          <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
