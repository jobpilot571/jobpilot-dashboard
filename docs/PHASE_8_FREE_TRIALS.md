# Phase 8 — Free Trials

## Completed
- `/admin/free-trials` live against `trial_students`
- KPIs: total, new, active/assigned, expiring ≤3 days, converted
- Alerts for expiring soon + overdue (batch mark expired)
- Search, status filters, employee filter, pagination
- Table: student, target role, trial window, apps completed, assign, status, follow-up, resume
- Edit dialog: dates, assignment, status, follow-up + notes
- Convert → best-effort set matched student `payment_status=paid`
- **No trial chat** (deferred)

## Follow-up status
Stored in `notes` as `follow_up:<status>` prefix until a dedicated column exists.

## Files
- `src/pages/admin/FreeTrialsPage.tsx`
- `src/components/trials/TrialEditDialog.tsx`
- `src/hooks/useTrialStudents.ts`
- `src/features/trials/constants.ts`

## Next
Phase 9: Reports page (performance, consistency subsection, trends, filters, export)
