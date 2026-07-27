import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EmailLogStatus =
  | "pending"
  | "sent"
  | "failed"
  | "resent"
  | "password_reset"
  | "delivered"
  | "opened"
  | "bounced";

export interface EmailLog {
  id: string;
  user_id: string | null;
  role: string | null;
  email: string;
  subject: string | null;
  email_type: string;
  status: EmailLogStatus;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

/** Latest welcome_credentials log per user_id. */
export function useWelcomeEmailLogs(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x))).sort();
  return useQuery({
    queryKey: ["email_logs", "welcome_credentials", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .in("user_id", ids)
        .eq("email_type", "welcome_credentials")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, EmailLog> = {};
      for (const row of (data ?? []) as EmailLog[]) {
        if (row.user_id && !map[row.user_id]) map[row.user_id] = row;
      }
      return map;
    },
  });
}
