import { UserX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoStudentProfile({ email }: { email?: string | null }) {
  return (
    <AppShell role="student">
      <div className="flex justify-center py-16">
        <Card className="max-w-md border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              Profile not ready
            </CardTitle>
            <CardDescription>
              No student record is linked to this login
              {email ? ` (${email})` : ""}. If you just signed up, refresh in a moment or contact support.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </AppShell>
  );
}
