# Phase 12 — QA, hardening & cutover readiness

## Completed
- **Responsive AppShell** — desktop sidebar; mobile hamburger + drawer (Esc / overlay / route close)
- **Admin Settings** — password change + feature-flag readout (no longer a placeholder)
- **Permission tightening**
  - Employee `useStudentAppStats(studentIds)` scoped to assigned students
  - Reports push student/employee scope into PostgREST `.in()` / `.eq()` (not client-only filter)
  - Employee/student hooks no longer select `payment_*` columns
- **Cutover docs** — checklist below; migration guide refreshed
- **README** updated for full rebuild status

## Not done in this workspace
- Applying SQL migration to production (no DB password / service role) — see `docs/APPLY_MIGRATION.md`
- DNS / hosting cutover from Lovable (manual ops)
- Live RLS policy audit in Supabase dashboard (enforce assigned-only server-side)

## Files
- `src/components/layout/AppShell.tsx`
- `src/pages/admin/SettingsPage.tsx`
- `src/hooks/useStudentAppStats.ts`
- `src/hooks/useReportsData.ts`
- `src/hooks/useMyStudents.ts`
- `src/hooks/useCurrentStudent.ts`
- `src/pages/employee/StudentsPage.tsx`
- `docs/APPLY_MIGRATION.md`
- `docs/CUTOVER.md`
- `README.md`

## Tested
- `npm run build`

## Cutover checklist
See `docs/CUTOVER.md`.

## Break risk
Low for UI. Migration apply is the only production schema change — review SQL before running.
