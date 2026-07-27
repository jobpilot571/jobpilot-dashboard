import { UserX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoEmployeeProfile({ email }: { email?: string | null }) {
  return (
    <AppShell role="employee">
      <div className="flex justify-center py-16">
        <Card className="max-w-md border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              No employee profile
            </CardTitle>
            <CardDescription>
              No employee record is linked to this login
              {email ? ` (${email})` : ""}. Ask an admin to create or link your employee account.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </AppShell>
  );
}
