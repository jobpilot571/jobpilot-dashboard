import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Sparkles,
  Target,
  User,
  Users,
  Briefcase,
  History,
  FileText,
  FolderOpen,
  X,
} from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  SidebarLayoutProvider,
  useSidebarLayout,
} from "@/contexts/SidebarLayoutContext";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/constants";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TZ } from "@/lib/timezone";

type NavItem = { title: string; to: string; icon: LucideIcon; end?: boolean };

const adminNav: NavItem[] = [
  { title: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { title: "Employees", to: "/admin/employees", icon: Users },
  { title: "Students", to: "/admin/students", icon: GraduationCap },
  { title: "Placement", to: "/admin/placement", icon: Target },
  { title: "Free Trials", to: "/admin/free-trials", icon: Sparkles },
  { title: "Reports", to: "/admin/reports", icon: BarChart3 },
  { title: "Settings", to: "/admin/settings", icon: User },
];

const employeeNav: NavItem[] = [
  { title: "Dashboard", to: "/app", icon: LayoutDashboard, end: true },
  { title: "Students", to: "/app/students", icon: GraduationCap },
  { title: "Applications", to: "/app/applications", icon: Briefcase },
  { title: "History", to: "/app/history", icon: History },
  { title: "Performance", to: "/app/performance", icon: Target },
  { title: "Reports", to: "/app/reports", icon: BarChart3 },
  { title: "Profile", to: "/app/profile", icon: User },
];

const studentNav: NavItem[] = [
  { title: "Dashboard", to: "/me", icon: LayoutDashboard, end: true },
  { title: "Progress", to: "/me/progress", icon: Target },
  { title: "History", to: "/me/history", icon: History },
  { title: "Profile", to: "/me/profile", icon: User },
  { title: "Documents", to: "/me/documents", icon: FolderOpen },
];

const panelLabel: Record<AppRole, string> = {
  admin: "Admin Panel",
  employee: "Employee Workspace",
  student: "Student Portal",
};

function navFor(role: AppRole): NavItem[] {
  if (role === "admin") return adminNav;
  if (role === "employee") return employeeNav;
  return studentNav;
}

function SidebarNav({
  items,
  onNavigate,
  onCollapse,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Shield className="h-4 w-4" />
        </div>
        <span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight">
          JobPilot.ai
        </span>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-primary/15 font-semibold text-sidebar-primary",
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.title}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5">
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate("/login"));
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </>
  );
}

function AppShellInner({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const location = useLocation();
  const items = navFor(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    setSidebarOpen,
    setForceSidebarClosed,
    forceSidebarClosed,
    effectiveSidebarOpen,
  } = useSidebarLayout();
  const today = formatInTimeZone(new Date(), BUSINESS_TZ, "EEE, MMM d zzz");

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const openSidebar = () => {
    setForceSidebarClosed(false);
    setSidebarOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {effectiveSidebarOpen ? (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <SidebarNav items={items} onCollapse={() => setSidebarOpen(false)} />
        </aside>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(16.5rem,85vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="absolute right-2 top-3">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav items={items} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            {!effectiveSidebarOpen ? (
              <button
                type="button"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted md:inline-flex"
                aria-label="Open sidebar"
                title={forceSidebarClosed ? "Open sidebar (closed for Job Applications)" : "Open sidebar"}
                onClick={openSidebar}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            ) : null}
            <div className="min-w-0 truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{panelLabel[role]}</span>
              <span className="mx-1.5 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{today}</span>
            </div>
          </div>
          <UserMenu />
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  return (
    <SidebarLayoutProvider>
      <AppShellInner role={role}>{children}</AppShellInner>
    </SidebarLayoutProvider>
  );
}

/** Lightweight page placeholder used until feature modules are built. */
export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <FileText className="h-4 w-4" />
          Scaffold placeholder
        </div>
        This page is wired into navigation and auth. Feature UI will be built in a later phase.
        <div className="mt-4">
          <Button variant="outline" size="sm" disabled>
            Coming next
          </Button>
        </div>
      </div>
    </div>
  );
}
