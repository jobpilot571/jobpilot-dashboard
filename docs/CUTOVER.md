# Cutover checklist — Lovable → rebuild

Use this when switching production traffic from the Lovable app (`jobpilot571/job-pilotai`) to this rebuild (`E:\JoBPilot_Dashboard`).

## 0. Preconditions
- [ ] `npm run build` succeeds locally
- [ ] `.env` points at live project `yvhayaaghhthlgwtgveh` (anon/publishable key only)
- [ ] Test logins for **admin**, **employee**, and **student** on staging/preview

## 1. Database
- [ ] Backup / note PITR
- [ ] Apply `supabase/migrations/20260723200000_employee_targets_and_student_payment.sql` (see `APPLY_MIGRATION.md`)
- [ ] Confirm Admin Dashboard no longer shows migration-pending alert
- [ ] Spot-check employee daily targets and student payment fields in Admin → Students

## 2. Auth & roles
- [ ] Admin → `/admin`
- [ ] Employee → `/app` (assigned students only; can log apps)
- [ ] Student → `/me` (read-only apps; coordinator card)
- [ ] Inactive employee/student blocked
- [ ] Force password change still works
- [ ] Password reset flow (`/reset-password`)

## 3. Feature parity smoke
| Area | Check |
|------|--------|
| Admin dashboard | KPIs + employee target progress |
| Employees | CRUD via `manage-employee`, welcome email |
| Students | Filters, payment, assign |
| Placement | Stages + history + CSV |
| Free trials | Assign/status (no chat) |
| Reports | Filters + consistency subsection + CSV |
| Employee apps | Insert with CST stamp + `created_by_employee_id` |
| Student portal | Progress / history / documents checklist |

## 4. Deferred (flags off — confirm still hidden)
- [ ] Resume enhancer (`resumeModule`)
- [ ] Application-details token form (`appDetailsModule`)
- [ ] Trial chat (`trialChatModule`)

## 5. Hosting (Vercel)
- [ ] `vercel.json` SPA rewrite present (ships with this repo)
- [ ] Link/deploy to existing Vercel project: `npx vercel` (preview) then `npx vercel --prod`
- [ ] Vercel env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- [ ] If not at domain root, set Vite `base` and rebuild
- [ ] Custom domain / SSL on the Vercel project
- [ ] Supabase Auth → URL Configuration: Site URL = production origin; Redirect URLs include `https://YOUR_DOMAIN/login` and `https://YOUR_DOMAIN/reset-password` (plus `*.vercel.app` preview if used)
- [ ] Keep Lovable URL / previous Vercel deployment as fallback until smoke passes

## 6. Go-live
- [ ] Point primary domain at rebuild
- [ ] Monitor auth errors + edge function logs (`manage-employee`, `send-welcome-credentials`)
- [ ] Announce cutover to ops team

## Rollback
Revert DNS / hosting to Lovable. DB migration is additive — leaving columns in place is safe for Lovable if it ignores unknown fields.
