# Phase 9 — Reports

## Completed
- `/admin/reports` live against `job_applications`, `employees`, `students`, `placement_pipeline_events`
- Filters: date range (default last 30 days CST), employee, student
- Sections: Overview, Employees, Students, Consistency, Breakdowns
- KPIs: apps in range / today / week, interviews, placements (offer), active/assigned/unassigned/inactive students
- Apps-by-day trend (CSS bars — no chart library)
- Employee performance vs per-employee daily target
- Student performance (top 50 by apps in range)
- Consistency subsection (7h active / 1h break / gap logic) using today’s apps by `created_by_employee_id`
- Breakdowns by role and company
- CSV export for KPIs, trend, employees, students
- By-source deferred (`job_applications` has no source column)

## Files
- `src/pages/admin/ReportsPage.tsx`
- `src/hooks/useReportsData.ts`
- `src/components/reports/Charts.tsx`
- `src/lib/consistency.ts`

## Tested
- `npm run build` succeeds

## Next
Phase 10: Employee dashboard (`/app/*`) — assigned students, daily target, apps, consistency

## Break risk
Low — read-only aggregations; no schema changes. Large date ranges may be slow until server-side aggregation exists.
