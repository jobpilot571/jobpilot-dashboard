# Phase 3 — Scaffold & Auth Shell

## Completed
- Vite + React + TypeScript + Tailwind v4 app in `E:\JoBPilot_Dashboard`
- Connected to live Supabase project `yvhayaaghhthlgwtgveh` via publishable (anon) key
- Auth: sign-in, sign-out, role from `users.role`, inactive account gate, force password change
- Role route trees with sidebar (no duplicate inner tabs)
- Feature-flag placeholders for resume / app-details / trial-chat
- Additive SQL migration drafted under `supabase/migrations/` — **not applied**

## Routes
| Role | Prefix | Pages |
|------|--------|-------|
| Admin | `/admin` | dashboard, employees, students, placement, free-trials, reports, settings |
| Employee | `/app` | dashboard, students, applications, history, performance, reports, profile |
| Student | `/me` | dashboard, progress, history, profile, documents |

## Decisions encoded
- Placement stage **keys** unchanged; labels in `src/lib/constants.ts`
- Payment statuses: `unpaid | partial | paid | waived | n/a` (default unpaid; amount/date/method/notes separate columns in migration)
- Daily target: per-employee column default 40 (migration)

## Not done yet
- Applying the SQL migration to production
- Building real Admin Dashboard / Employees / etc. feature UIs
- Regenerating Supabase types after migration

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173 and sign in with a live JobPilot account.
