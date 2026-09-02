import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Mail, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentOverviewTab } from "@/components/students/profile/OverviewTab";
import { StudentJobApplicationsTab } from "@/components/students/profile/JobApplicationsTab";
import { StudentProfileTab } from "@/components/students/profile/ProfileTab";
import { StudentApplicationDetailsTab } from "@/components/students/profile/ApplicationDetailsTab";
import { StudentForwardedTab } from "@/components/students/profile/ForwardedTab";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { useMyStudents } from "@/hooks/useMyStudents";
import { useStudentById, useStudentOverviewStats } from "@/hooks/useStudentProfile";
import { useSidebarLayout } from "@/contexts/SidebarLayoutContext";
import { getInitials } from "@/features/employees/constants";
import { employeeSeesAllStudents } from "@/lib/employees";
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

const TAB_IDS = new Set<Tab>(TABS.map((t) => t.id));

function parseTab(value: string | null): Tab {
  if (value && TAB_IDS.has(value as Tab)) return value as Tab;
  return "overview";
}

function CloseSidebarOnJobApps({ active }: { active: boolean }) {
  const { setForceSidebarClosed } = useSidebarLayout();
  useEffect(() => {
    setForceSidebarClosed(active);
    return () => setForceSidebarClosed(false);
  }, [active, setForceSidebarClosed]);
  return null;
}

export default function EmployeeStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === "overview") nextParams.delete("tab");
    else nextParams.set("tab", next);
    setParams(nextParams, { replace: true });
  };

  const { user } = useAuth();
  const { data: employee, isLoading: empLoading } = useCurrentEmployee();
  const { data: myStudents = [], isLoading: myLoading } = useMyStudents(employee?.id, {
    includeInactive: true,
    accessAllStudents: employeeSeesAllStudents(employee),
  });
  const assigned = useMemo(() => myStudents.some((s) => s.id === id), [myStudents, id]);

  const { data: student, isLoading, isError, error } = useStudentById(assigned ? id : undefined);
  const { data: stats, isLoading: statsLoading } = useStudentOverviewStats(assigned ? id : undefined);

  if (!empLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  if (empLoading || myLoading || (assigned && isLoading)) {
    return (
      <AppShell role="employee">
        <Skeleton className="h-48 w-full rounded-3xl" />
      </AppShell>
    );
  }

  if (!assigned || isError || !student) {
    return (
      <AppShell role="employee">
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h1 className="font-display text-xl font-semibold">
            {!assigned ? "Student not assigned to you" : "Student not found"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {!assigned
              ? "You can only open students assigned to your account."
              : getErrorMessage(error, "Missing student record.")}
          </p>
          <Button type="button" variant="outline" onClick={() => navigate("/app/students")}>
            Back to students
          </Button>
        </div>
      </AppShell>
    );
  }

  const bucket = getStudentBucket(student);
  const initials = getInitials(student.name);

  return (
    <AppShell role="employee">
      <CloseSidebarOnJobApps active={tab === "apps"} />
      <div className={cn("mx-auto space-y-5", tab !== "apps" && "max-w-6xl")}>
        <div>
          <Link
            to="/app/students"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My students
          </Link>
        </div>

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

            <div className="grid min-w-0 grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Coach</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold">
                  <User className="h-4 w-4 opacity-70" />
                  {employee?.name ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Progress</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {stats ? `${Math.min(100, Math.round((stats.todayApps / 40) * 100))}%` : "—"}
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
          <StudentJobApplicationsTab studentId={student.id} employeeId={employee?.id} />
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
          <StudentForwardedTab studentId={student.id} employeeId={employee?.id} />
        ) : null}
      </div>
    </AppShell>
  );
}
