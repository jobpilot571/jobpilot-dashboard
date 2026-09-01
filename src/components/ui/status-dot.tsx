import { cn } from "@/lib/utils";

type StatusDotTone = "active" | "pending" | "inactive";

const TONE: Record<StatusDotTone, { dot: string; ping: string; label: string }> = {
  active: { dot: "bg-emerald-500", ping: "bg-emerald-400", label: "Active" },
  pending: { dot: "bg-amber-400", ping: "bg-amber-300", label: "Pending" },
  inactive: { dot: "bg-muted-foreground/40", ping: "bg-muted-foreground/30", label: "Inactive" },
};

export function StatusDot({
  tone,
  pulse = tone === "active",
}: {
  tone: StatusDotTone;
  pulse?: boolean;
}) {
  const cfg = TONE[tone];
  return (
    <span
      className="relative inline-flex h-2.5 w-2.5 shrink-0"
      title={cfg.label}
      aria-label={cfg.label}
    >
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            cfg.ping,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", cfg.dot)} />
    </span>
  );
}
