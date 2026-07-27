# JobPilot.ai Dashboard (rebuild)

Clean rebuild of the JobPilot operations dashboard on the **live Supabase** project `yvhayaaghhthlgwtgveh`.

## Stack
- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router + TanStack Query
- Supabase Auth + Postgres (existing production DB)

## Quick start
1. Copy `.env.example` → `.env` and fill publishable (anon) key values.
2. `npm install`
3. `npm run dev` → http://localhost:5173

## Roles
| Role | Prefix |
|------|--------|
| Admin | `/admin` |
| Employee | `/app` |
| Student | `/me` |

## Phase status
| Phase | Status | Doc |
|-------|--------|-----|
| 1–2 Analysis / page map | Done | `docs/PAGE_MAP.md` |
| 3 Scaffold + auth | Done | `docs/PHASE_3_SCAFFOLD.md` |
| 4 Admin dashboard | Done | `docs/PHASE_4_DASHBOARD.md` |
| 5 Employees | Done | `docs/PHASE_5_EMPLOYEES.md` |
| 6 Students | Done | `docs/PHASE_6_STUDENTS.md` |
| 7 Placement | Done | `docs/PHASE_7_PLACEMENT.md` |
| 8 Free trials | Done | `docs/PHASE_8_FREE_TRIALS.md` |
| 9 Reports | Done | `docs/PHASE_9_REPORTS.md` |
| 10 Employee workspace | Done | `docs/PHASE_10_EMPLOYEE.md` |
| 11 Student portal | Done | `docs/PHASE_11_STUDENT.md` |
| 12 QA + cutover readiness | Done | `docs/PHASE_12_CUTOVER.md`, `docs/CUTOVER.md` |

## Structure
```
src/
  components/   # auth, layout, ui, feature panels
  contexts/     # AuthContext
  features/     # deferred modules (flags off) + documents constants
  hooks/
  integrations/supabase/
  lib/          # constants, feature-flags, timezone, consistency
  pages/        # admin | employee | student | auth
supabase/migrations/  # additive SQL — apply manually after backup
docs/
```

## Before production cutover
1. Apply migration: `docs/APPLY_MIGRATION.md`
2. Follow checklist: `docs/CUTOVER.md`
3. Confirm Auth redirect URLs include the new origin

## Feature flags (off in v1)
`resumeModule`, `appDetailsModule`, `trialChatModule` — see `src/lib/feature-flags.ts`
