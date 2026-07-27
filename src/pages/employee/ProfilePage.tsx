import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { NoEmployeeProfile } from "@/components/employee/NoEmployeeProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { employeeDailyTarget } from "@/lib/employees";
import { supabase } from "@/integrations/supabase/client";

export default function EmployeeProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { data: employee, isLoading } = useCurrentEmployee();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoading && !employee) {
    return <NoEmployeeProfile email={user?.email} />;
  }

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    if (user?.id) {
      await supabase
        .from("users")
        .update({
          must_change_password: false,
          temporary_password_active: false,
          password_updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }
    setSaving(false);
    setPassword("");
    setConfirm("");
    toast.success("Password updated.");
    await refreshProfile();
  };

  return (
    <AppShell role="employee">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account details and password.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Account</CardTitle>
            <CardDescription>Managed by your administrator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading || !employee ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{employee.name}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{employee.email}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Role category</span>
                  <span className="font-medium">{employee.job_role_category || "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{employee.status}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Daily target</span>
                  <span className="font-medium tabular-nums">
                    {employeeDailyTarget(employee)} / student
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void onPassword(e)}>
              <div className="space-y-2">
                <Label htmlFor="pw">New password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
