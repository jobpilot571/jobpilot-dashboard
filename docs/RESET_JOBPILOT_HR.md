# Reset JoBPilot_HR → JobPilot Dashboard only

**Project:** `coecxgpttnunopxgfxct` (JoBPilot_HR)  
**Warning:** This deletes all existing public tables/data in that project (old HR + mixed schema).

I cannot run SQL on your Supabase account from here. You run these 2 scripts in the SQL Editor.

---

## Step 1 — Wipe everything in `public`

1. Supabase → **JoBPilot_HR** → **SQL Editor**
2. Paste & run: `supabase/migrations/20260729000000_wipe_public_schema.sql`
3. Optional: **Authentication → Users** → delete all users for a clean start

## Step 2 — Create fresh dashboard schema

1. New SQL query
2. Paste & run: `supabase/migrations/20260729000001_fresh_dashboard_schema.sql`
3. Confirm Table Editor shows: `users`, `employees`, `students`, `job_applications`, …

## Step 3 — First admin

1. **Authentication → Users → Add user** (email + password, auto-confirm ON)
2. Copy user UUID → run:

```sql
INSERT INTO public.users (id, email, role, must_change_password)
VALUES (
  'PASTE-AUTH-USER-UUID',
  'your-admin@email.com',
  'admin',
  false
);
```

## Step 4 — Connect the app

`.env` and Vercel:

```
VITE_SUPABASE_PROJECT_ID=coecxgpttnunopxgfxct
VITE_SUPABASE_URL=https://coecxgpttnunopxgfxct.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<Legacy anon eyJ... key>
```

Restart `npm run dev`. Sign in as the admin you created.

## Step 5 — Edge functions (later, for Create employee / login)

```bash
npx supabase link --project-ref coecxgpttnunopxgfxct
npx supabase functions deploy manage-employee
npx supabase functions deploy send-welcome-credentials
```

## Do not

- Do not re-run the old `20260728000000_jobpilot_hr_bootstrap.sql` (merge/ALTER version)
- Do not use Resume_Enhancer for this app
