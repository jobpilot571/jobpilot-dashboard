import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { placementStageLabel, type PipelineStage } from "@/features/placement/constants";
import {
  useDeletePipelineEvent,
  type PipelineEvent,
} from "@/hooks/usePlacement";
import { PlacementEventDialog } from "@/components/placement/PlacementEventDialog";

export function StageHistoryDialog({
  open,
  onClose,
  studentName,
  studentId,
  stage,
  events,
}: {
  open: boolean;
  onClose: () => void;
  studentName: string;
  studentId: string;
  stage: PipelineStage;
  events: PipelineEvent[];
}) {
  const del = useDeletePipelineEvent();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineEvent | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const stageEvents = useMemo(
    () => events.filter((e) => e.student_id === studentId && e.stage === stage),
    [events, studentId, stage],
  );

  const remove = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success("Event deleted.");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        wide
        title={`${studentName} — ${placementStageLabel(stage)}`}
        description="Full history for this pipeline stage."
        footer={
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add event
            </Button>
          </div>
        }
      >
        {stageEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events in this stage yet.</p>
        ) : (
          <ul className="space-y-3">
            {stageEvents.map((ev) => (
              <li key={ev.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {ev.company_name || "Untitled"} · {ev.job_role || "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[ev.event_date, ev.event_time, ev.status || ev.result].filter(Boolean).join(" · ") ||
                        "No schedule/status"}
                    </p>
                    {ev.notes ? <p className="mt-1 text-xs text-muted-foreground">{ev.notes}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ev.completed ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">Completed</Badge>
                      ) : null}
                      {ev.salary_or_rate ? (
                        <Badge className="border-border bg-muted text-muted-foreground">{ev.salary_or_rate}</Badge>
                      ) : null}
                      {ev.joining_date ? (
                        <Badge className="border-border bg-muted text-muted-foreground">
                          Join {ev.joining_date}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(ev);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmId(ev.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <PlacementEventDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        studentId={studentId}
        stage={stage}
        initial={editing}
      />

      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Delete event?"
        description="This removes the pipeline event permanently."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={del.isPending}
              onClick={() => confirmId && void remove(confirmId)}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">Confirm deletion of this placement event.</p>
      </Dialog>
    </>
  );
}
