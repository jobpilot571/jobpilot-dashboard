import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { History, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useStartDateHistory } from "@/hooks/useStartDateHistory";
import { applyStartDateChange } from "@/lib/startDateChange";
import { studentStartDate, type Student } from "@/lib/students";
import { formatDateTimeCST, formatRosterDate } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export function LockedStartDateCell({
  date,
  disabled,
  onChangeClick,
  onHistoryClick,
}: {
  date: string | null;
  disabled?: boolean;
  onChangeClick: () => void;
  onHistoryClick: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate text-xs tabular-nums text-foreground">
        {formatRosterDate(date)}
      </span>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        title="Change start date"
        aria-label="Change start date"
        disabled={disabled}
        onClick={onChangeClick}
      >
        <Pencil className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Start date history"
        aria-label="Start date history"
        onClick={onHistoryClick}
      >
        <History className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ConfirmStartDateChangeDialog({
  student,
  open,
  onClose,
}: {
  student: Student | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const current = (student ? studentStartDate(student) : "")?.slice(0, 10) ?? "";
  const [nextDate, setNextDate] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNextDate(current);
  }, [open, current]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["students"] });
    void queryClient.invalidateQueries({ queryKey: ["student-billing"] });
    void queryClient.invalidateQueries({ queryKey: ["start-date-history"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const confirm = async () => {
    if (!student) return;
    setSaving(true);
    try {
      const actorEmail = user?.email ?? "";
      const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
      const result = await applyStartDateChange({
        student,
        newDate: nextDate,
        actor: {
          id: user?.id ?? null,
          name: meta?.full_name || meta?.name || actorEmail.split("@")[0] || "Admin",
          email: actorEmail,
        },
      });
      invalidate();
      if (result.emailSent) {
        toast.success("Start date updated and admin emailed.");
      } else {
        toast.warning(`Start date updated, but email failed: ${result.emailError || "unknown error"}.`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update start date.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change start date?"
      description={
        student
          ? `This is locked so it cannot be changed by accident. You will be emailed, and the change is saved in history.`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !nextDate || nextDate === current} onClick={() => void confirm()}>
            {saving ? "Saving…" : "Confirm change"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Current start date:{" "}
          <span className="font-medium text-foreground">{formatRosterDate(current || null)}</span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-start-date">New start date</Label>
          <Input
            id="new-start-date"
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

export function StartDateHistoryDialog({
  student,
  open,
  onClose,
}: {
  student: Student | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data = [], isLoading, isError, error } = useStartDateHistory(open ? student?.id ?? null : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Start date history"
      description={student ? `Changes for ${student.name}` : undefined}
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
        <p className="text-sm text-muted-foreground">No start date changes recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[32%] px-2 py-2 font-medium">When</th>
                <th className="w-[28%] px-2 py-2 font-medium">Who</th>
                <th className="w-[20%] px-2 py-2 font-medium">From</th>
                <th className="w-[20%] px-2 py-2 font-medium">To</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {formatDateTimeCST(row.created_at)}
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <p className="truncate text-xs font-medium">{row.changed_by_name || "Admin"}</p>
                    <p className={cn("truncate text-[11px] text-muted-foreground")}>{row.changed_by_email}</p>
                  </td>
                  <td className="px-2 py-2 text-xs tabular-nums">{formatRosterDate(row.old_date)}</td>
                  <td className="px-2 py-2 text-xs tabular-nums">{formatRosterDate(row.new_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
