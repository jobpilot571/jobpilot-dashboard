# Connect dashboard → JoBPilot_HR (`coecxgpttnunopxgfxct`)

## 1. Apply schema (required)

1. Open Supabase → project **JoBPilot_HR**
2. **SQL Editor** → New query
3. Paste entire file:  
   `supabase/migrations/20260728000000_jobpilot_hr_bootstrap.sql`
4. Run. Confirm tables exist: `users`, `employees`, `students`, `job_applications`, …

## 2. Create first admin

1. Supabase → **Authentication → Users → Add user**
   - Email + password
   - Auto-confirm email: **ON**
2. Copy the new user’s **UUID**
3. SQL Editor → run (replace email + uuid):

```sql
INSERT INTO public.users (id, email, role, must_change_password)
VALUES (
  'PASTE-AUTH-USER-UUID',
  'your-admin@email.com',
  'admin',
  false
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = EXCLUDED.email;
```

## 3. App env (local + Vercel)

```
VITE_SUPABASE_PROJECT_ID=coecxgpttnunopxgfxct
VITE_SUPABASE_URL=https://coecxgpttnunopxgfxct.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Legacy anon eyJ... key from JoBPilot_HR>
```

Find the key: **Project Settings → API Keys → Legacy anon / public** (starts with `eyJ`).

After setting Vercel env vars → **Redeploy**.

## 4. Auth URLs

**Authentication → URL Configuration**

- Site URL: your Vercel domain (or `http://localhost:5173` for local)
- Redirect URLs:  
  `http://localhost:5173/**`  
  `https://YOUR_VERCEL_DOMAIN/**`

## 5. Deploy edge functions (employee/student logins)

From this repo (with [Supabase CLI](https://supabase.com/docs/guides/cli) logged in):

```bash
npx supabase login
npx supabase link --project-ref coecxgpttnunopxgfxct
npx supabase functions deploy manage-employee
npx supabase functions deploy send-welcome-credentials
```

Without `manage-employee`, Admin can still create student **rows**, but **Create employee / Create login** will fail until deployed.

`send-welcome-credentials` is a stub (logs only) until you add an email provider — copy temporary passwords from the UI.

## 6. Smoke test

1. `npm run dev` → sign in as admin  
2. Create an employee + student  
3. Log a job application  

## Notes

- This is a **fresh** database (no old Lovable data).
- Do **not** use Resume_Enhancer for this app.
- Old project id `yvhayaaghhthlgwtgveh` is retired for this rebuild.
