import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { NoStudentProfile } from "@/components/student/NoStudentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentStudent, useMyCounselor } from "@/hooks/useCurrentStudent";
import { supabase } from "@/integrations/supabase/client";

type ProfileJson = {
  title?: string;
  location?: string;
  skills?: string[];
  linkedin?: string;
  work_authorization?: string | boolean | null;
};

function parseProfileJson(raw: unknown): ProfileJson | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ProfileJson;
}

export default function StudentProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { data: student, isLoading } = useCurrentStudent();
  const { data: counselor } = useMyCounselor(student?.assigned_to);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoading && !student) {
    return <NoStudentProfile email={user?.email} />;
  }

  const profile = parseProfileJson(student?.profile_json);

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
    <AppShell role="student">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account details and password.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Account</CardTitle>
            <CardDescription>Contact your coordinator to update program details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading || !student ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{student.name}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{student.email}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{student.phone || "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Program</span>
                  <span className="font-medium">{student.program || "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{student.status}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Coordinator</span>
                  <span className="font-medium">{counselor?.name ?? "Unassigned"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {profile && (profile.title || profile.location || (profile.skills?.length ?? 0) > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Resume profile</CardTitle>
              <CardDescription>Parsed profile summary on file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {profile.title ? (
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-medium">{profile.title}</span>
                </div>
              ) : null}
              {profile.location ? (
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{profile.location}</span>
                </div>
              ) : null}
              {profile.linkedin ? (
                <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">LinkedIn</span>
                  <a
                    href={
                      profile.linkedin.startsWith("http")
                        ? profile.linkedin
                        : `https://${profile.linkedin}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    View
                  </a>
                </div>
              ) : null}
              {profile.skills && profile.skills.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-muted-foreground">Skills</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.slice(0, 24).map((skill) => (
                      <Badge key={skill} className="border-border bg-muted text-muted-foreground">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

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
