import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { SimpleBarList } from "@/components/reports/Charts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Target, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useStudentPortalStats } from "@/hooks/useStudentPortal";

export default function StudentProgressPage() {
  const { user } = useAuth();
  const { data: student, isLoading: stuLoading } = useCurrentStudent();
  const { data: stats, isLoading } = useStudentPortalStats(student?.id);

  if (!stuLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  return (
    <AppShell role="student">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Application status and placement pipeline breakdown.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {isLoading || !stats ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard label="Applications" value={stats.appsTotal} icon={Briefcase} />
              <StatCard label="Interviews" value={stats.interviews} icon={Target} tone="info" />
              <StatCard
                label="Offers"
                value={stats.offers}
                icon={Trophy}
                tone={stats.offers > 0 ? "success" : "default"}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">By application status</CardTitle>
              <CardDescription>How your logged applications are marked</CardDescription>
            </CardHeader>
            <CardContent>
              {stats ? (
                <SimpleBarList
                  items={stats.byStatus
                    .filter((s) => s.count > 0)
                    .map((s) => ({ name: s.label, count: s.count }))}
                />
              ) : (
                <Skeleton className="h-40" />
              )}
              {stats && stats.byStatus.every((s) => s.count === 0) ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No applications yet.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Placement pipeline</CardTitle>
              <CardDescription>Interview and offer stage events</CardDescription>
            </CardHeader>
            <CardContent>
              {stats ? (
                <SimpleBarList
                  items={stats.byStage
                    .filter((s) => s.count > 0)
                    .map((s) => ({ name: s.label, count: s.count }))}
                />
              ) : (
                <Skeleton className="h-40" />
              )}
              {stats && stats.byStage.every((s) => s.count === 0) ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No placement events yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
