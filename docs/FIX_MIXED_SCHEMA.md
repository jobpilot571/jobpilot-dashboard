# Fix: JoBPilot_HR mixed with Dashboard schema

## Revert to HR-only (do this now)

1. Open Supabase → **JoBPilot_HR** → **SQL Editor**
2. Paste and run the entire file:  
   `supabase/migrations/20260728010000_cleanup_jobpilot_from_hr.sql`
3. Confirm success (no errors).
4. Optional verify queries are at the bottom of that file (commented).

This removes dashboard tables (`students`, `job_applications`, `users`, …), view, functions, policies, `resumes` bucket, and columns we added on `employees` (including `email`).

**Do not** re-run the dashboard bootstrap on this project afterward.

## If something still looks wrong
Use **Database → Backups / PITR** and restore to before the bootstrap.

## Dashboard next
Point JobPilot Dashboard at a **different** empty Supabase project later — never mix into JoBPilot_HR again.
