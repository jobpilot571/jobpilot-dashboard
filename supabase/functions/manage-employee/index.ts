import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" });

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: callerUser },
      error: callerErr,
    } = await caller.auth.getUser();
    if (callerErr || !callerUser) return json({ error: "Unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("users")
      .select("role")
      .eq("id", callerUser.id)
      .maybeSingle();
    if (roleRow?.role !== "admin") return json({ error: "Admin only" });

    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "create_employee") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const role = String(body.role ?? "Counselor").trim() || "Counselor";
      const jobRoleCategory = String(body.job_role_category ?? "");
      if (!email || !name) return json({ error: "name and email required" });

      const password = randomPassword();
      const userId = await ensureAuthUser(admin, email, password);

      await admin.from("users").delete().eq("email", email);
      const { error: userUpsertErr } = await admin.from("users").upsert({
        id: userId,
        email,
        role: "employee",
        must_change_password: true,
        temporary_password_active: true,
      });
      if (userUpsertErr) return json({ error: userUpsertErr.message });

      const { data: existingEmp } = await admin
        .from("employees")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingEmp?.id) {
        const { error: empUpErr } = await admin
          .from("employees")
          .update({
            user_id: userId,
            name,
            role,
            job_role_category: jobRoleCategory,
            status: "active",
          })
          .eq("id", existingEmp.id);
        if (empUpErr) return json({ error: empUpErr.message });
      } else {
        const { error: empInsErr } = await admin.from("employees").insert({
          user_id: userId,
          name,
          email,
          role,
          job_role_category: jobRoleCategory || "",
          avatar: "",
          status: "active",
        });
        if (empInsErr) return json({ error: empInsErr.message });
      }

      return json({ user_id: userId, password, email });
    }

    if (action === "create_student_login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const studentId = String(body.student_id ?? "");
      if (!email || !studentId) return json({ error: "student_id and email required" });

      const { data: studentRow, error: stuLookupErr } = await admin
        .from("students")
        .select("id, email, assigned_to, status")
        .eq("id", studentId)
        .maybeSingle();
      if (stuLookupErr) return json({ error: stuLookupErr.message });
      if (!studentRow) return json({ error: "Student not found" });

      const password = randomPassword();
      const userId = await ensureAuthUser(admin, email, password);

      await admin.from("users").delete().eq("email", email);
      const { error: userErr } = await admin.from("users").upsert({
        id: userId,
        email,
        role: "student",
        must_change_password: true,
        temporary_password_active: true,
      });
      if (userErr) return json({ error: userErr.message });

      const nextStatus =
        studentRow.status === "inactive"
          ? "inactive"
          : studentRow.assigned_to
            ? "active"
            : studentRow.status || "pending";

      const { data: linked, error: stuErr } = await admin
        .from("students")
        .update({
          user_id: userId,
          email,
          status: nextStatus,
        })
        .eq("id", studentId)
        .select("id, user_id")
        .maybeSingle();
      if (stuErr) return json({ error: stuErr.message });
      if (!linked?.id || linked.user_id !== userId) {
        return json({ error: "Failed to link Auth user to student row" });
      }

      return json({ user_id: userId, password, email, student_id: studentId });
    }

    // Recreate Auth login for an existing employee row (post-migration orphan user_ids)
    if (action === "create_employee_login") {
      const employeeId = String(body.employee_id ?? "");
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!employeeId || !email) return json({ error: "employee_id and email required" });

      const password = randomPassword();
      const userId = await ensureAuthUser(admin, email, password);

      await admin.from("users").delete().eq("email", email);
      const { error: userErr } = await admin.from("users").upsert({
        id: userId,
        email,
        role: "employee",
        must_change_password: true,
        temporary_password_active: true,
      });
      if (userErr) return json({ error: userErr.message });

      const { error: empErr } = await admin
        .from("employees")
        .update({ user_id: userId })
        .eq("id", employeeId);
      if (empErr) return json({ error: empErr.message });

      return json({ user_id: userId, password, email });
    }

    if (action === "reset_password") {
      const userId = String(body.user_id ?? "");
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = (String(body.role ?? "employee").toLowerCase() === "student" ? "student" : "employee") as
        | "student"
        | "employee";
      const newPassword = String(body.new_password ?? "").trim();
      if (!userId || !newPassword) return json({ error: "user_id and new_password required" });

      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (!error) {
        await admin
          .from("users")
          .update({
            must_change_password: true,
            temporary_password_active: true,
            password_updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        return json({ ok: true, password: newPassword, user_id: userId });
      }

      const msg = (error.message || "").toLowerCase();
      if (!email || (!msg.includes("not found") && !msg.includes("user not found"))) {
        return json({ error: error.message });
      }

      // Auth user missing after DB restore — recreate and remlink
      const newUserId = await ensureAuthUser(admin, email, newPassword);
      await admin.from("users").delete().eq("email", email);
      if (newUserId !== userId) {
        await admin.from("users").delete().eq("id", userId);
      }
      const { error: userErr } = await admin.from("users").insert({
        id: newUserId,
        email,
        role,
        must_change_password: true,
        temporary_password_active: true,
        password_updated_at: new Date().toISOString(),
      });
      if (userErr) return json({ error: userErr.message });

      if (role === "employee") {
        await admin.from("employees").update({ user_id: newUserId }).eq("email", email);
        await admin.from("employees").update({ user_id: newUserId }).eq("user_id", userId);
      } else {
        await admin.from("students").update({ user_id: newUserId }).eq("email", email);
        await admin.from("students").update({ user_id: newUserId }).eq("user_id", userId);
      }

      return json({ ok: true, password: newPassword, user_id: newUserId, recreated: true });
    }

    return json({ error: `Unknown action: ${action}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) });
  }
});

async function ensureAuthUser(admin: AdminClient, email: string, password: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
    for (let page = 1; page <= 20; page++) {
      const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) throw new Error(listErr.message);
      const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, { password });
        if (upErr) throw new Error(upErr.message);
        return existing.id;
      }
      if (!listed?.users?.length || listed.users.length < 200) break;
    }
  }
  throw new Error(error?.message || "Failed to create auth user");
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
