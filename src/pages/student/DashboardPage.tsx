import { Link } from "react-router-dom";
import {
  Briefcase,
  CalendarDays,
  FileText,
  Mail,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { AppStatusBadge } from "@/components/applications/AppStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent, useMyCounselor } from "@/hooks/useCurrentStudent";
import { useStudentPortalStats } from "@/hooks/useStudentPortal";
import { formatTimeCST } from "@/lib/timezone";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { data: student, isLoading: stuLoading, isError, error, refetch } = useCurrentStudent();
  const { data: counselor } = useMyCounselor(student?.assigned_to);
  const { data: stats, isLoading: statsLoading } = useStudentPortalStats(student?.id);

  if (!stuLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  const firstName = (student?.name ?? user?.email ?? "there").split(" ")[0].split("@")[0];
  const docPct =
    student && student.documents_total > 0
      ? Math.round((student.documents_submitted / student.documents_total) * 100)
      : 0;
  const loading = stuLoading || statsLoading;

  return (
    <AppShell role="student">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Welcome, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your job search progress and coordinator info.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>

        {isError ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load dashboard</CardTitle>
              <CardDescription>{error instanceof Error ? error.message : "Unknown error"}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!stuLoading && student && !student.assigned_to ? (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm">
            <p className="font-medium text-foreground">Coordinator assignment pending</p>
            <p className="mt-1 text-muted-foreground">
              Our team will assign your coordinator shortly. You will see their contact details here
              once assigned.
            </p>
          </div>
        ) : null}

        {counselor ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <User className="h-4 w-4 text-primary" />
                Your coordinator
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="font-medium">{counselor.name}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {counselor.email}
              </span>
              {counselor.job_role_category ? (
                <Badge className="border-border bg-muted text-muted-foreground">
                  {counselor.job_role_category}
                </Badge>
              ) : null}
              <a
                href={`mailto:${counselor.email}`}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Contact
              </a>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading || !stats || !student ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-xl" />)
          ) : (
            <>
              <StatCard label="Total applications" value={stats.appsTotal} icon={Briefcase} />
              <StatCard
                label="This week"
                value={stats.appsThisWeek}
                hint={`${stats.appsToday} today`}
                icon={CalendarDays}
                tone="info"
              />
              <StatCard label="Interviews" value={stats.interviews} icon={Target} />
              <StatCard
                label="Offers"
                value={stats.offers}
                icon={Trophy}
                tone={stats.offers > 0 ? "success" : "default"}
              />
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <FileText className="h-4 w-4 text-primary" />
                Documents
              </CardTitle>
              <CardDescription>
                {student
                  ? `${student.documents_submitted} of ${student.documents_total} on file`
                  : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {student ? <ProgressBar value={docPct} /> : <Skeleton className="h-4" />}
              <div className="mt-4">
                <Link
                  to="/me/documents"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                >
                  View documents
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {student ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Program</span>
                    <span className="font-medium">{student.program || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{student.status}</span>
                  </div>
                  <div className="pt-2">
                    <Link
                      to="/me/progress"
                      className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                    >
                      View progress
                    </Link>
                  </div>
                </>
              ) : (
                <Skeleton className="h-20" />
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Recent applications</CardTitle>
            <CardDescription>Submitted by your JobPilot coordinator on your behalf.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Company / Role</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentApps ?? []).map((a) => (
                    <tr key={a.id} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{a.company_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{a.job_role || "—"}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <AppStatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {a.applied_date} · {formatTimeCST(a.applied_at)}
                      </td>
                    </tr>
                  ))}
                  {!loading && (stats?.recentApps.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No applications yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border p-3">
              <Link to="/me/history" className="text-xs font-medium text-primary hover:underline">
                View full history →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
