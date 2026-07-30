import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: callerUser },
      error: callerErr,
    } = await caller.auth.getUser();
    if (callerErr || !callerUser) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("users")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();
    if (roleRow?.role !== "admin") return json({ error: "Admin only" }, 403);

    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "create_employee") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const role = String(body.role ?? "Counselor").trim() || "Counselor";
      const jobRoleCategory = String(body.job_role_category ?? "");
      if (!email || !name) return json({ error: "name and email required" }, 400);

      const password = randomPassword();
      const userId = await ensureAuthUser(admin, email, password);

      await admin.from("users").upsert({
        id: userId,
        email,
        role: "employee",
        must_change_password: true,
        temporary_password_active: true,
      });

      const { data: existingEmp } = await admin
        .from("employees")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingEmp?.id) {
        await admin
          .from("employees")
          .update({
            user_id: userId,
            name,
            role,
            job_role_category: jobRoleCategory,
            status: "active",
          })
          .eq("id", existingEmp.id);
      } else {
        await admin.from("employees").insert({
          user_id: userId,
          name,
          email,
          role,
          job_role_category: jobRoleCategory,
          status: "active",
          daily_target: 40,
        });
      }

      return json({ user_id: userId, password, email });
    }

    if (action === "create_student_login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const studentId = String(body.student_id ?? "");
      if (!email || !studentId) return json({ error: "student_id and email required" }, 400);

      const password = randomPassword();
      const userId = await ensureAuthUser(admin, email, password);

      await admin.from("users").upsert({
        id: userId,
        email,
        role: "student",
        must_change_password: true,
        temporary_password_active: true,
      });
      await admin.from("students").update({ user_id: userId }).eq("id", studentId);

      return json({ user_id: userId, password, email });
    }

    if (action === "reset_password") {
      const userId = String(body.user_id ?? "");
      const newPassword = String(body.new_password ?? "").trim();
      if (!userId || !newPassword) return json({ error: "user_id and new_password required" }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return json({ error: error.message }, 400);

      await admin
        .from("users")
        .update({
          must_change_password: true,
          temporary_password_active: true,
          password_updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      return json({ ok: true, password: newPassword });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function ensureAuthUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<string> {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(error.message);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message || "Failed to create auth user");
  return data.user.id;
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
