import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { StudentForwardedTab } from "@/components/students/profile/ForwardedTab";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";

export default function StudentForwardedPage() {
  const { user } = useAuth();
  const { data: student, isLoading } = useCurrentStudent();

  if (!isLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  return (
    <AppShell role="student">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Placement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track forwarded applications across Assessment, Screening, Interview, Panel, HR, Offer letter,
            and Rejected. You can add cards and upload screenshots; only an admin can delete.
          </p>
        </div>

        {isLoading || !student ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <StudentForwardedTab studentId={student.id} />
        )}
      </div>
    </AppShell>
  );
}
