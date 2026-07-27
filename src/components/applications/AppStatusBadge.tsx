import { cn } from "@/lib/utils";
import { APP_STATUSES } from "@/hooks/useJobApplications";

const tone: Record<string, string> = {
  applied: "border-emerald-200 bg-emerald-50 text-emerald-800",
  incomplete: "border-amber-200 bg-amber-50 text-amber-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
  forwarded: "border-sky-200 bg-sky-50 text-sky-800",
};

export function AppStatusBadge({ status }: { status: string }) {
  const label = APP_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
        tone[status] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
