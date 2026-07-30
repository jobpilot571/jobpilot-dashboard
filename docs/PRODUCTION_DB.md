# Production DB — JB_Dashboard (restored)

**Active project:** `JB_Dashboard` / `pawxtwqwxvjrpyvyvppf`  
**Source backup:** `lovable_export/job-pilotai_260730.backup` (from `yvhayaaghhthlgwtgveh`)

## Restored data (approx.)
| Table | Rows |
|-------|------|
| employees | 11 |
| students | 27 |
| job_applications | 28,813 |
| users (public) | 41 |
| trial_students | 3 |
| placement_pipeline_events | 2 |

Notes:
- Student `user_id` cleared where Auth users were missing (recreate logins via Admin as needed).
- One duplicate student email was skipped.

## Local
`.env` → JB_Dashboard. `npm run dev` → http://localhost:5173

## Vercel
Set and **Redeploy**:
```
VITE_SUPABASE_PROJECT_ID=pawxtwqwxvjrpyvyvppf
VITE_SUPABASE_URL=https://pawxtwqwxvjrpyvyvppf.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<JB_Dashboard legacy anon eyJ key>
```

## Auth URLs (JB_Dashboard project)
Site URL + redirects for `https://jobpilotagent.online` and localhost.

## Security
**Rotate the database password** in Supabase (it was shared in chat).
