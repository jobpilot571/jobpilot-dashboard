import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const SIDEBAR_STORAGE_KEY = "jobpilot-sidebar-open";

type SidebarLayoutContextValue = {
  sidebarOpen: boolean;
  /** User toggle — persists preference */
  setSidebarOpen: (open: boolean) => void;
  /** Temporary close (e.g. Job Applications tab) — does not change saved preference */
  forceSidebarClosed: boolean;
  setForceSidebarClosed: (closed: boolean) => void;
  /** Effective visibility after force override */
  effectiveSidebarOpen: boolean;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

function readSidebarOpen(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpenState] = useState(readSidebarOpen);
  const [forceSidebarClosed, setForceSidebarClosed] = useState(false);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      forceSidebarClosed,
      setForceSidebarClosed,
      effectiveSidebarOpen: sidebarOpen && !forceSidebarClosed,
    }),
    [sidebarOpen, setSidebarOpen, forceSidebarClosed],
  );

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>;
}

export function useSidebarLayout() {
  const ctx = useContext(SidebarLayoutContext);
  if (!ctx) {
    throw new Error("useSidebarLayout must be used within AppShell");
  }
  return ctx;
}

export { SIDEBAR_STORAGE_KEY };
