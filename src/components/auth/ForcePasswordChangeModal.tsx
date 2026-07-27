import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ForcePasswordChangeModal() {
  const { user, mustChangePassword, refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (!mustChangePassword || !user) return null;

  const onSubmit = async (e: FormEvent) => {
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
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setSaving(false);
      toast.error(authError.message);
      return;
    }

    const { error: flagError } = await supabase
      .from("users")
      .update({
        must_change_password: false,
        temporary_password_active: false,
        password_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (flagError) {
      toast.error(flagError.message);
      return;
    }

    toast.success("Password updated.");
    await refreshProfile();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Update your password</CardTitle>
          <CardDescription>
            For security, you must set a new password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
