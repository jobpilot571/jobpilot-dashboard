import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_APP_URL = "https://www.jobpilotagent.online";
const REMINDER_DAYS_BEFORE = 5;

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
const FROM_EMAIL =
  Deno.env.get("WELCOME_FROM_EMAIL") || "JobPilot.ai <noreply@jobpilot.solutions>";


function todayCST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

function daysUntil(target: string, today: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [ny, nm, nd] = target.split("-").map(Number);
  if (!ty || !ny) return Number.NaN;
  return Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

function formatNice(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
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

    if (!resendKey) {
      return json({
        success: false,
        error: "Email provider not configured. Set RESEND_API_KEY on the edge function.",
        sent: 0,
        skipped: 0,
      });
    }

    const today = todayCST();
    const { data: students, error: stuErr } = await admin
      .from("students")
      .select(
        "id, name, email, user_id, status, payment_status, next_pay_date, payment_reminder_sent_on, payment_amount",
      )
      .neq("status", "inactive");
    if (stuErr) throw stuErr;

    let sent = 0;
    let skipped = 0;

    for (const s of students ?? []) {
      const stored = String(s.payment_status || "").toLowerCase();
      if (stored === "waived" || stored === "n/a") {
        skipped += 1;
        continue;
      }
      const due = s.next_pay_date as string | null;
      if (!due) {
        skipped += 1;
        continue;
      }
      const days = daysUntil(due, today);
      if (!(days >= 1 && days <= REMINDER_DAYS_BEFORE)) {
        skipped += 1;
        continue;
      }
      if (s.payment_reminder_sent_on === today) {
        skipped += 1;
        continue;
      }

      const email = String(s.email || "").trim().toLowerCase();
      const name = String(s.name || "there");
      if (!email) {
        skipped += 1;
        continue;
      }

      const subject = `Payment reminder — due ${formatNice(due)}`;
      const html = reminderHtml({
        name,
        due: formatNice(due),
        days,
        rate: s.payment_amount != null ? Number(s.payment_amount) : null,
        appUrl: APP_URL,
      });

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html }),
      });
      const sendBody = await sendRes.json().catch(() => ({}));
      const ok = sendRes.ok;
      await admin.from("email_logs").insert({
        user_id: s.user_id || null,
        email,
        role: "student",
        email_type: "payment_reminder",
        subject,
        status: ok ? "sent" : "failed",
        provider_message_id: sendBody?.id ? String(sendBody.id) : null,
        sent_at: ok ? new Date().toISOString() : null,
        error_message: ok ? null : String(sendBody?.message || sendBody?.error || `Resend HTTP ${sendRes.status}`),
      });

      if (ok) {
        await admin.from("students").update({ payment_reminder_sent_on: today }).eq("id", s.id);
        sent += 1;
      } else {
        skipped += 1;
      }
    }

    return json({ success: true, sent, skipped, date: today });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e), sent: 0, skipped: 0 });
  }
});

function reminderHtml(opts: {
  name: string;
  due: string;
  days: number;
  rate: number | null;
  appUrl: string;
}) {
  const first = opts.name.split(" ")[0] || opts.name;
  const loginUrl = `${opts.appUrl.replace(/\/$/, "")}/login`;
  const when = opts.days === 1 ? "tomorrow" : `in ${opts.days} days`;
  const rateLine =
    opts.rate != null && opts.rate > 0
      ? `<tr><td style="font-size:14px;line-height:1.5;padding-bottom:12px;">Amount due: <strong>$${opts.rate.toFixed(2)}</strong></td></tr>`
      : "";

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;padding:32px;text-align:left;">
        <tr><td style="font-size:22px;font-weight:700;padding-bottom:8px;">JobPilot.ai</td></tr>
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px;">Payment reminder</td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:12px;">Hi ${escapeHtml(first)},</td></tr>
        <tr><td style="font-size:14px;line-height:1.5;padding-bottom:12px;">
          Your next payment is due <strong>${escapeHtml(opts.due)}</strong> (${escapeHtml(when)}).
        </td></tr>
        ${rateLine}
        <tr><td style="padding-top:12px;" align="center">
          <a href="${loginUrl}" style="display:inline-block;background:#f5c542;color:#0f172a;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;">Open JobPilot.ai</a>
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
