import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InactiveAccountScreen({ role }: { role: "employee" | "student" }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account inactive</CardTitle>
          <CardDescription>
            Your {role} account is inactive. Contact an administrator if you need access restored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
