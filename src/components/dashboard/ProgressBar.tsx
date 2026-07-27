import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const capped = Math.max(0, value);
  const width = Math.min(capped, 100);
  const color =
    capped >= 100 ? "bg-emerald-500" : capped >= 70 ? "bg-primary" : capped >= 40 ? "bg-amber-500" : "bg-destructive";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${width}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">{capped}%</span>
    </div>
  );
}
