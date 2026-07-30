# Connect & go live — JB_Dashboard

**Project:** `JB_Dashboard`  
**Ref:** `pawxtwqwxvjrpyvyvppf`  
**URL:** `https://pawxtwqwxvjrpyvyvppf.supabase.co`

Do **not** use JoBPilot_HR or Resume_Enhancer for this app.

---

## 1. Apply schema (empty project — no wipe needed)

1. Supabase → **JB_Dashboard** → **SQL Editor**
2. Paste & run entire file:  
   `supabase/migrations/20260729000001_fresh_dashboard_schema.sql`
3. Table Editor should show: `users`, `employees`, `students`, `job_applications`, …

## 2. Create first admin

1. **Authentication → Users → Add user**
   - Email + password
   - Auto Confirm User: **ON**
2. Copy the user’s UUID
3. SQL Editor:

```sql
INSERT INTO public.users (id, email, role, must_change_password)
VALUES (
  'PASTE-AUTH-USER-UUID',
  'your-admin@email.com',
  'admin',
  false
);
```

## 3. App env (local + Vercel)

Use the **Legacy anon** key (starts with `eyJ…`), not `sb_secret_…`.

```
VITE_SUPABASE_PROJECT_ID=pawxtwqwxvjrpyvyvppf
VITE_SUPABASE_URL=https://pawxtwqwxvjrpyvyvppf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

Local: put in `.env`, then restart `npm run dev`.  
Vercel: Project → Settings → Environment Variables (Production + Preview) → **Redeploy**.

## 4. Auth redirect URLs

**Authentication → URL Configuration**

- Site URL: your production domain (e.g. `https://YOUR_VERCEL_DOMAIN`)
- Redirect URLs include:
  - `http://localhost:5173/**`
  - `https://YOUR_VERCEL_DOMAIN/**`
  - `https://YOUR_VERCEL_DOMAIN/login`
  - `https://YOUR_VERCEL_DOMAIN/reset-password`

## 5. Deploy edge functions

```bash
npx supabase login
npx supabase link --project-ref pawxtwqwxvjrpyvyvppf
npx supabase functions deploy manage-employee
npx supabase functions deploy send-welcome-credentials
```

## 6. Production smoke test

- [ ] Admin login
- [ ] Create employee (needs `manage-employee`)
- [ ] Create student + log a job application
- [ ] Password reset email link opens set-password UI
- [ ] Deep link refresh works (Vercel SPA rewrite)

## 7. Cutover

- Point domain / promote Vercel production
- Keep previous Lovable/HR projects untouched
