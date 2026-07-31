import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Mail, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentOverviewTab } from "@/components/students/profile/OverviewTab";
import { StudentJobApplicationsTab } from "@/components/students/profile/JobApplicationsTab";
import { StudentProfileTab } from "@/components/students/profile/ProfileTab";
import { StudentApplicationDetailsTab } from "@/components/students/profile/ApplicationDetailsTab";
import { StudentForwardedTab } from "@/components/students/profile/ForwardedTab";
import { useEmployees } from "@/hooks/useEmployees";
import { useStudentById, useStudentOverviewStats } from "@/hooks/useStudentProfile";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { getInitials } from "@/features/employees/constants";
import { getStudentBucket } from "@/lib/students";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Tab = "overview" | "apps" | "profile" | "details" | "forwarded";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "apps", label: "Job Applications" },
  { id: "profile", label: "Profile" },
  { id: "details", label: "Application Details" },
  { id: "forwarded", label: "Forwarded" },
];

/** Closes the left sidebar while Job Applications is active for a wider table. */
function CloseSidebarOnJobApps({ active }: { active: boolean }) {
  const { setForceSidebarClosed } = useSidebarLayout();
  useEffect(() => {
    setForceSidebarClosed(active);
    return () => setForceSidebarClosed(false);
  }, [active, setForceSidebarClosed]);
  return null;
}

export default function AdminStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(() =>
    tabParam === "apps" ||
    tabParam === "profile" ||
    tabParam === "details" ||
    tabParam === "forwarded" ||
    tabParam === "overview"
      ? tabParam
      : "overview",
  );

  useEffect(() => {
    const t = searchParams.get("tab");
    if (
      t === "apps" ||
      t === "profile" ||
      t === "details" ||
      t === "forwarded" ||
      t === "overview"
    ) {
      setTab(t);
    }
  }, [searchParams]);

  const { data: student, isLoading, isError, error } = useStudentById(id);
  const { data: stats, isLoading: statsLoading } = useStudentOverviewStats(id);
  const { data: employees = [] } = useEmployees();


  const coach = useMemo(
    () => employees.find((e) => e.id === student?.assigned_to),
    [employees, student?.assigned_to],
  );

  if (isLoading) {
    return (
      <AppShell role="admin">
        <Skeleton className="h-48 w-full rounded-3xl" />
      </AppShell>
    );
  }

  if (isError || !student) {
    return (
      <AppShell role="admin">
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="font-display text-xl font-semibold">Student not found</h1>
          <p className="text-sm text-muted-foreground">{getErrorMessage(error, "Missing student record.")}</p>
          <Button type="button" variant="outline" onClick={() => navigate("/admin/students")}>
            Back to students
          </Button>
        </div>
      </AppShell>
    );
  }

  const bucket = getStudentBucket(student);
  const initials = getInitials(student.name);

  return (
    <AppShell role="admin">
      <CloseSidebarOnJobApps active={tab === "apps"} />
      <div className={cn("mx-auto space-y-5", tab === "apps" ? "max-w-7xl" : "max-w-6xl")}>
        <div>
          <Link
            to="/admin/students"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Students
          </Link>
        </div>

        {/* Hero — no Docs card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#123a8a] via-[#1d4ed8] to-[#0ea5e9] p-5 text-white shadow-xl sm:p-6">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold backdrop-blur">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge
                    className={
                      bucket === "inactive"
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-emerald-300/40 bg-emerald-400/20 text-emerald-50"
                    }
                  >
                    {bucket === "assigned" ? "Active" : bucket}
                  </Badge>
                  {student.program ? (
                    <Badge className="gap-1 border-white/20 bg-white/10 text-white">
                      <Briefcase className="h-3 w-3" />
                      {student.program}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{student.name}</h1>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {student.email}
                  </span>
                  <span>Applied {student.applied_date || "—"}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Coach</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold">
                  <User className="h-4 w-4 opacity-70" />
                  {coach?.name ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Progress</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {stats
                    ? `${Math.min(100, Math.round((stats.todayApps / 40) * 100))}%`
                    : "—"}
                </p>
                <p className="text-[11px] text-white/60">
                  {stats ? `${stats.todayApps}/40 apps today` : ""}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition",
                tab === t.id
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <StudentOverviewTab student={student} stats={stats} loading={statsLoading} />
        ) : null}
        {tab === "apps" ? (
          <StudentJobApplicationsTab studentId={student.id} employeeId={student.assigned_to} />
        ) : null}
        {tab === "profile" ? (
          <StudentProfileTab
            studentId={student.id}
            studentName={student.name}
            studentEmail={student.email}
            profileJson={student.profile_json}
            loading={false}
          />
        ) : null}
        {tab === "details" ? <StudentApplicationDetailsTab /> : null}
        {tab === "forwarded" ? (
          <StudentForwardedTab studentId={student.id} employeeId={student.assigned_to} />
        ) : null}
      </div>
    </AppShell>
  );
}
