import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "request" | "update";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setMode("update");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("If that email exists, a reset link was sent.");
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You can sign in now.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "update" ? "Choose a new password" : "Reset password"}</CardTitle>
          <CardDescription>
            {mode === "update"
              ? "Enter a new password for your JobPilot account."
              : "We’ll email you a link to choose a new password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "update" ? (
            <form className="space-y-4" onSubmit={(e) => void onUpdate(e)}>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? "Saving…" : "Update password"}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void onRequest(e)}>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="underline-offset-2 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
