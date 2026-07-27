import { CheckCircle2, Clock, KeyRound, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EmailLog } from "@/hooks/useEmailLogs";
import { format } from "date-fns";

export function EmailStatusBadge({ log }: { log: EmailLog | null | undefined }) {
  if (!log) {
    return (
      <Badge className="border-border bg-muted text-muted-foreground">
        <Clock className="h-3 w-3" /> Not sent
      </Badge>
    );
  }

  const styles: Record<string, { cls: string; label: string; Icon: typeof Clock }> = {
    pending: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-700", label: "Pending", Icon: Clock },
    sent: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", label: "Welcome email sent", Icon: CheckCircle2 },
    resent: { cls: "border-sky-500/30 bg-sky-500/10 text-sky-700", label: "Credentials resent", Icon: Send },
    password_reset: {
      cls: "border-violet-500/30 bg-violet-500/10 text-violet-700",
      label: "Password reset & sent",
      Icon: KeyRound,
    },
    delivered: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", label: "Delivered", Icon: CheckCircle2 },
    failed: { cls: "border-destructive/30 bg-destructive/10 text-destructive", label: "Failed", Icon: XCircle },
    bounced: { cls: "border-destructive/30 bg-destructive/10 text-destructive", label: "Bounced", Icon: XCircle },
  };

  const s = styles[log.status] ?? styles.pending;
  const Icon = s.Icon;
  const ts = log.sent_at ?? log.created_at;
  const tip = ts ? format(new Date(ts), "MMM d, yyyy 'at' h:mm a") : "";

  return (
    <Badge className={s.cls} title={tip || undefined}>
      <Icon className="h-3 w-3" /> {s.label}
    </Badge>
  );
}
