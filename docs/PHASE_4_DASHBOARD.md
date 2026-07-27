# Phase 4 — Admin Dashboard

## Completed
- Live Admin Dashboard at `/admin` reading production Supabase
- KPIs: employees, students, assigned/unassigned, free trials, apps today/week, interviews, placements
- Employee performance vs per-employee daily target (DB column when present, else default 40)
- Student status summary, alerts, recent application activity
- Types updated for upcoming columns; graceful fallback if migration not applied
- Migration apply guide: `docs/APPLY_MIGRATION.md`

## Database
- Migration **not auto-applied** (no DB URL / service role in workspace)
- SQL ready: `supabase/migrations/20260723200000_employee_targets_and_student_payment.sql`

## Next
Phase 5: Employees management page (CRUD, targets, assign, welcome email)
