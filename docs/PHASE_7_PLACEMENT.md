# Phase 7 — Placement page

## Completed
- `/admin/placement` live against `student_placement_summary` + `placement_pipeline_events`
- Stage **keys unchanged**: `assessment | screening | technical | panel | offer`
- Improved UI labels (Active job search / Recruiter screening / etc.)
- Summary KPIs + per-stage counts
- Filters: search, employee, stage, status, date range
- Click stage count → history dialog (add / edit / delete events)
- CSV export

## Files
- `src/pages/admin/PlacementPage.tsx`
- `src/components/placement/{PlacementEventDialog,StageHistoryDialog}.tsx`
- `src/hooks/usePlacement.ts`
- `src/features/placement/constants.ts`

## Database
No schema changes.

## Next
Phase 8: Free Trials page (no chat)
