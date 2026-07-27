import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { APP_STATUSES } from "@/hooks/useJobApplications";
import { FORWARD_STAGES, type ForwardStageKey } from "@/features/placement/constants";
import { cn } from "@/lib/utils";

type Props = {
  status: string;
  forwardStage?: ForwardStageKey | "";
  disabled?: boolean;
  className?: string;
  onSelectStatus: (status: string) => void;
  onSelectForwardStage: (stage: ForwardStageKey) => void;
};

function statusDotClass(status: string) {
  if (status === "applied") return "bg-emerald-500";
  if (status === "forwarded") return "bg-sky-500";
  if (status === "rejected") return "bg-destructive";
  return "bg-amber-500";
}

function displayLabel(status: string, forwardStage?: ForwardStageKey | "") {
  if (status === "forwarded" && forwardStage) {
    return FORWARD_STAGES.find((s) => s.key === forwardStage)?.label ?? "Forwarded";
  }
  if (status === "forwarded") return "Forwarded";
  return APP_STATUSES.find((s) => s.value === status)?.label ?? (status || "Select status");
}

/**
 * Status dropdown with nested Forwarded submenu
 * (Assessment / Screening / Technical / Panel) layered in the same menu.
 */
export function AppStatusMenu({
  status,
  forwardStage = "",
  disabled,
  className,
  onSelectStatus,
  onSelectForwardStage,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState<"status" | "forward">("status");
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, layer]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setLayer("status");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (layer === "forward") setLayer("status");
        else {
          setOpen(false);
          setLayer("status");
        }
      }
    };
    const onScroll = () => updatePos();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, layer]);

  const pickStatus = (value: string) => {
    if (value === "forwarded") {
      setLayer("forward");
      return;
    }
    onSelectStatus(value);
    setOpen(false);
    setLayer("status");
  };

  const pickStage = (stage: ForwardStageKey) => {
    onSelectForwardStage(stage);
    setOpen(false);
    setLayer("status");
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[80] w-[172px] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          {layer === "status" ? (
            <ul className="py-1" role="listbox">
              {APP_STATUSES.map((s) => (
                <li key={s.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={status === s.value && s.value !== "forwarded"}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted",
                      status === s.value && s.value !== "forwarded" && "bg-muted font-semibold",
                      s.value === "forwarded" &&
                        status === "forwarded" &&
                        "bg-sky-50 font-semibold text-sky-900",
                    )}
                    onClick={() => pickStatus(s.value)}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(s.value))} />
                    <span className="flex-1">{s.label}</span>
                    {s.value === "forwarded" ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div>
              <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Forwarded →
              </div>
              <ul className="py-1" role="listbox">
                {FORWARD_STAGES.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={forwardStage === s.key}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-sky-50",
                        forwardStage === s.key && "bg-sky-50 font-semibold text-sky-900",
                      )}
                      onClick={() => pickStage(s.key)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full border-t border-border px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
                onClick={() => setLayer("status")}
              >
                ← Back
              </button>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setLayer("status");
        }}
        className={cn(
          "inline-flex h-8 min-w-[140px] max-w-[180px] items-center gap-2 rounded-md border border-input bg-card px-2.5 text-left text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/60 disabled:opacity-50",
          open && "ring-2 ring-ring",
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass(status))} />
        <span className="min-w-0 flex-1 truncate">{displayLabel(status, forwardStage)}</span>
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition", open && "rotate-90")}
        />
      </button>
      {menu}
    </div>
  );
}
