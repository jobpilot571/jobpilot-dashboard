import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  variant = "default",
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  variant?: "default" | "hero";
  to?: string;
}) {
  if (variant === "hero") {
    const body = (
      <>
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/20" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-white">{value}</p>
            {hint ? <p className="mt-1.5 text-xs text-white/65">{hint}</p> : null}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </>
    );
    const className =
      "group relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4 shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-xl";
    if (to) {
      return (
        <Link to={to} className={cn(className, "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60")}>
          {body}
        </Link>
      );
    }
    return <div className={className}>{body}</div>;
  }

  const tones = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-700",
    warning: "bg-amber-500/10 text-amber-700",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-sky-500/10 text-sky-700",
  } as const;

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );

  const className =
    "rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md";

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          className,
          "block cursor-pointer hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
