import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_APP_URL = "https://www.jobpilotagent.online";
const FROM_EMAIL =
  Deno.env.get("WELCOME_FROM_EMAIL") || "JobPilot.ai <noreply@jobpilot.solutions>";

function resolveAppUrl(): string {
  const raw = (Deno.env.get("APP_URL") || DEFAULT_APP_URL).trim();
  try {
    const u = new URL(raw);
    if (u.hostname === "jobpilotagent.online" || u.hostname === "www.jobpilotagent.online") {
      return DEFAULT_APP_URL;
    }
    return u.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

const APP_URL = resolveAppUrl();

function formatNice(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso || "—";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(y, m - 1, d),
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    if (roleRow?.role !== "admin") {
      return json({ success: false, error: "Admin only" });
    }

    const body = (await req.json().catch(() => ({}))) as {
      student_id?: string;
      name?: string;
      old_date?: string | null;
      new_date?: string | null;
      changed_by_name?: string;
    };

    const studentId = String(body.student_id || "").trim();
    if (!studentId) return json({ success: false, error: "student_id is required" });

    const { data: student, error: stuErr } = await admin
      .from("students")
      .select("id, name, email")
      .eq("id", studentId)
      .maybeSingle();
    if (stuErr) throw stuErr;
    if (!student) return json({ success: false, error: "Student not found" });

    const adminEmail = String(user.email || "")
      .trim()
      .toLowerCase();
    if (!adminEmail) return json({ success: false, error: "Admin has no email" });

    if (!resendKey) {
      return json({
        success: false,
        error: "Email provider not configured. Set RESEND_API_KEY on the edge function.",
      });
    }

    const studentName = String(body.name || student.name || "Student");
    const studentEmail = String(student.email || "").trim();
    const oldNice = body.old_date ? formatNice(String(body.old_date).slice(0, 10)) : "not set";
    const newNice = body.new_date ? formatNice(String(body.new_date).slice(0, 10)) : "not set";
    const changer = String(body.changed_by_name || user.email || "Admin");
    const subject = `Start date changed — ${studentName}`;
    const html = changeHtml({
      studentName,
      studentEmail,
      oldNice,
      newNice,
      changer,
      appUrl: APP_URL,
    });

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [adminEmail], subject, html }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    const ok = sendRes.ok;

    await admin.from("email_logs").insert({
      user_id: user.id,
      email: adminEmail,
      role: "admin",
      email_type: "start_date_changed",
      subject,
      status: ok ? "sent" : "failed",
      provider_message_id: sendBody?.id ? String(sendBody.id) : null,
      sent_at: ok ? new Date().toISOString() : null,
      error_message: ok
        ? null
        : String(sendBody?.message || sendBody?.error || `Resend HTTP ${sendRes.status}`),
    });

    if (!ok) {
      return json({
        success: false,
        error: String(sendBody?.message || sendBody?.error || `Resend HTTP ${sendRes.status}`),
      });
    }

    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

function changeHtml(opts: {
  studentName: string;
  studentEmail: string;
  oldNice: string;
  newNice: string;
  changer: string;
  appUrl: string;
}) {
  const loginUrl = `${opts.appUrl.replace(/\/$/, "")}/admin/students`;
  const studentLine = opts.studentEmail
    ? `${escapeHtml(opts.studentName)} (${escapeHtml(opts.studentEmail)})`
    : escapeHtml(opts.studentName);
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:32px;text-align:left;">
        <tr><td style="font-size:22px;font-weight:700;padding-bottom:8px;">JobPilot.ai</td></tr>
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px;">Start date changed</td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:12px;">
          A student start date was updated by ${escapeHtml(opts.changer)}.
        </td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:8px;">Student: <strong>${studentLine}</strong></td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:8px;">Previous start date: <strong>${escapeHtml(opts.oldNice)}</strong></td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:16px;">New start date: <strong>${escapeHtml(opts.newNice)}</strong></td></tr>
        <tr><td style="padding-top:8px;" align="center">
          <a href="${loginUrl}" style="display:inline-block;background:#f5c542;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;">Open Students</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
