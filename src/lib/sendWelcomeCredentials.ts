import { supabase } from "@/integrations/supabase/client";

export interface SendWelcomeInput {
  user_id: string;
  email: string;
  name: string;
  role: "student" | "employee";
  password?: string;
  is_resend?: boolean;
  reset_password?: boolean;
}

export interface SendWelcomeResult {
  success: boolean;
  email_status?: "sent" | "resent" | "password_reset" | "failed" | "not_sent";
  sent_at?: string;
  password_reset?: boolean;
  error?: string;
  error_code?: string;
}

export async function sendWelcomeCredentials(input: SendWelcomeInput): Promise<SendWelcomeResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-welcome-credentials", {
      body: input,
    });
    if (error) {
      const msg =
        (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) ||
        error.message ||
        "Edge function error";
      return { success: false, error: msg };
    }
    return (data ?? { success: false, error: "Empty response" }) as SendWelcomeResult;
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
