import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = Deno.env.get("APP_URL") || "https://www.jobpilotagent.online";
const FROM_EMAIL =
  Deno.env.get("WELCOME_FROM_EMAIL") || "JobPilot.ai <noreply@notify.jobpilotagent.online>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing Authorization" });

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ success: false, error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
    if (roleRow?.role !== "admin") return json({ success: false, error: "Admin only" });

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "there").trim() || "there";
    const role = (String(body.role ?? "student").toLowerCase() === "employee" ? "employee" : "student") as
      | "student"
      | "employee";
    const userId = String(body.user_id ?? "");
    const isResend = Boolean(body.is_resend);
    const resetPassword = Boolean(body.reset_password);
    let password = body.password ? String(body.password) : "";

    if (!email || !userId) {
      return json({ success: false, error: "user_id and email are required" });
    }

    // Resend / reset without a password → generate one and apply to Auth
    if (!password && (isResend || resetPassword)) {
      password = randomPassword();
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwErr) return json({ success: false, error: pwErr.message });
      await admin
        .from("users")
        .update({
          must_change_password: true,
          temporary_password_active: true,
          password_updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    if (!password) {
      return json({
        success: false,
        error: "No password available to email. Create login or reset password first.",
        error_code: "missing_password",
        email_status: "failed",
      });
    }

    if (!resendKey) {
      await logEmail(admin, {
        user_id: userId,
        email,
        role,
        status: "failed",
        error_message: "RESEND_API_KEY secret not set on send-welcome-credentials",
        subject: welcomeSubject(name, role, isResend, resetPassword),
      });
      return json({
        success: false,
        error: "Email provider not configured. Set RESEND_API_KEY on the edge function.",
        error_code: "missing_resend_key",
        email_status: "failed",
      });
    }

    const subject = welcomeSubject(name, role, isResend, resetPassword);
    const html = welcomeHtml({ name, email, password, role, appUrl: APP_URL, resetPassword, isResend });

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    const sendBody = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      const errMsg = String(sendBody?.message || sendBody?.error || `Resend HTTP ${sendRes.status}`);
      await logEmail(admin, {
        user_id: userId,
        email,
        role,
        status: "failed",
        error_message: errMsg,
        subject,
      });
      // HTTP 200 so the browser receives the error body (Supabase invoke hides non-2xx bodies)
      return json({ success: false, error: errMsg, email_status: "failed" });
    }

    const status = resetPassword ? "password_reset" : isResend ? "resent" : "sent";
    const sentAt = new Date().toISOString();
    await logEmail(admin, {
      user_id: userId,
      email,
      role,
      status,
      subject,
      provider_message_id: sendBody?.id ? String(sendBody.id) : null,
      sent_at: sentAt,
      error_message: null,
    });

    return json({
      success: true,
      email_status: status,
      sent_at: sentAt,
      password_reset: resetPassword || isResend,
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

function welcomeSubject(name: string, role: string, isResend: boolean, resetPassword: boolean) {
  if (resetPassword && !isResend) return `JobPilot.ai password reset — ${name}`;
  if (isResend) return `Your JobPilot.ai login details — ${name}`;
  return `Welcome to JobPilot.ai — your login details, ${name.split(" ")[0] || name}`;
}

function welcomeHtml(opts: {
  name: string;
  email: string;
  password: string;
  role: string;
  appUrl: string;
  resetPassword: boolean;
  isResend: boolean;
}) {
  const first = opts.name.split(" ")[0] || opts.name;
  const loginUrl = `${opts.appUrl.replace(/\/$/, "")}/login`;
  const intro = opts.resetPassword && !opts.isResend
    ? `Your JobPilot.ai password was reset. Use the credentials below to sign in as a <strong>${opts.role}</strong>.`
    : opts.isResend
      ? `Here are your JobPilot.ai login details again (as a <strong>${opts.role}</strong>).`
      : `An account has been created for you on JobPilot.ai as a <strong>${opts.role}</strong>. Use the credentials below to sign in.`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:32px;text-align:left;">
        <tr><td style="font-size:22px;font-weight:700;padding-bottom:8px;">JobPilot.ai</td></tr>
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px;">Welcome, ${escapeHtml(first)}!</td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:20px;">${intro}</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f2744;border-radius:10px;padding:20px;color:#fff;">
            <tr><td style="font-size:11px;letter-spacing:0.06em;opacity:0.8;padding-bottom:4px;">EMAIL</td></tr>
            <tr><td style="font-size:15px;font-weight:600;padding-bottom:14px;">${escapeHtml(opts.email)}</td></tr>
            <tr><td style="font-size:11px;letter-spacing:0.06em;opacity:0.8;padding-bottom:4px;">TEMPORARY PASSWORD</td></tr>
            <tr><td style="font-size:15px;font-weight:600;">${escapeHtml(opts.password)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${loginUrl}" style="display:inline-block;background:#f5c542;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;">Sign in to JobPilot.ai</a>
        </td></tr>
        <tr><td style="padding-top:18px;font-size:12px;color:#64748b;line-height:1.4;">
          If the button does not work, open: ${escapeHtml(loginUrl)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function logEmail(
  admin: ReturnType<typeof createClient>,
  row: {
    user_id: string;
    email: string;
    role: string;
    status: string;
    subject: string;
    provider_message_id?: string | null;
    sent_at?: string | null;
    error_message?: string | null;
  },
) {
  try {
    await admin.from("email_logs").insert({
      user_id: row.user_id,
      email: row.email,
      role: row.role,
      email_type: "welcome_credentials",
      subject: row.subject,
      status: row.status,
      provider_message_id: row.provider_message_id ?? null,
      sent_at: row.sent_at ?? null,
      error_message: row.error_message ?? null,
    });
  } catch (e) {
    console.error("email_logs insert failed", e);
  }
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `Jp${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10)}!`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
