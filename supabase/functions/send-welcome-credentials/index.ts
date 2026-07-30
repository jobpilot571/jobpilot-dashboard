import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Stub welcome-mail function for JoBPilot_HR bootstrap.
 * Logs the attempt; returns success so Admin UI can continue.
 * Wire Resend/SMTP later via secrets if needed.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing Authorization" }, 401);
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json();
    const email = String(body.email ?? "");
    const role = String(body.role ?? "");
    const admin = createClient(supabaseUrl, serviceKey);

    await admin.from("email_logs").insert({
      user_id: body.user_id ?? user.id,
      email,
      email_type: body.reset_password ? "password_reset" : "welcome",
      subject: `JobPilot credentials (${role})`,
      status: "not_sent",
      role,
      error_message: "Email provider not configured — share password manually",
    });

    return json({
      success: true,
      email_status: "not_sent",
      error: "Email provider not configured — copy password from UI / toast",
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
