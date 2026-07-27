import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signedInAt] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  const email = user?.email ?? "";
  const displayName = email.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const loggedInLabel = signedInAt.toLocaleString();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted",
          open && "bg-muted",
        )}
      >
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-foreground sm:inline">
          {displayName}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm ring-2 ring-primary/15">
          {initial}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          <div className="px-3 py-3">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email || "—"}</p>
          </div>
          <div className="mx-1 border-t border-border" />
          <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Logged in {loggedInLabel}</span>
          </div>
          <div className="mx-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => navigate("/login"));
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
