import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/auth/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_HOME } from "@/lib/constants";

/** Only allow same-app relative paths (blocks //evil.com open redirects). */
function safeAppPath(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  return path;
}

export default function LoginPage() {
  const { user, role, loading, signIn, configError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  if (configError) return <LoadingScreen message={configError} />;
  if (loading) return <LoadingScreen />;

  if (user && role) {
    const redirect = safeAppPath(searchParams.get("redirect"));
    return <Navigate to={redirect || ROLE_HOME[role]} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Signed in");
    // Role load happens via AuthContext; Navigate above will kick in after role resolves.
    navigate("/");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, hsl(224 76% 48% / 0.12), transparent 50%), radial-gradient(ellipse at 80% 100%, hsl(188 90% 42% / 0.08), transparent 45%)",
        }}
      />
      <Card className="relative w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">JobPilot.ai</CardTitle>
          <CardDescription>Sign in to your operations dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/reset-password" className="underline-offset-2 hover:underline">
              Forgot password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
