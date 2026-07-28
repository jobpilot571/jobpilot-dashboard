import { Shield } from "lucide-react";

export function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Shield className="h-6 w-6" />
      </div>
      <p className="max-w-lg text-sm text-foreground">{message}</p>
    </div>
  );
}
