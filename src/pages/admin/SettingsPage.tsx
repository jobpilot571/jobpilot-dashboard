import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { featureFlags } from "@/lib/feature-flags";

export default function AdminSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

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
    <AppShell role="admin">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account security and feature flags for this rebuild.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Signed-in admin</CardTitle>
            <CardDescription>Identity from Supabase Auth</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">User id</span>
              <span className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                {user?.id ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void onPassword(e)}>
              <div className="space-y-2">
                <Label htmlFor="admin-pw">New password</Label>
                <Input
                  id="admin-pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-pw2">Confirm password</Label>
                <Input
                  id="admin-pw2"
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

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Feature flags (v1)</CardTitle>
            <CardDescription>Deferred modules — keep off until product enables them</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(Object.keys(featureFlags) as (keyof typeof featureFlags)[]).map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                >
                  <span className="font-mono text-xs">{key}</span>
                  <span
                    className={
                      featureFlags[key]
                        ? "text-emerald-700"
                        : "text-muted-foreground"
                    }
                  >
                    {featureFlags[key] ? "on" : "off"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
