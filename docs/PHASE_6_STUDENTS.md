# Phase 6 — Students page

## Completed
- `/admin/students` live against production Supabase
- Search, status filters (All / Active / Pending / Inactive), employee filter, sort, pagination
- Table: student, program, assigned employee, apps, interviews, payment, status, welcome email
- Add / edit with assignment + payment fields (status/amount/date/method/notes)
- Detail panel: profile meta, reassign, recent applications
- Activate / deactivate (unassigns on deactivate), create login, reset password, resend welcome

## Files
- `src/pages/admin/StudentsPage.tsx`
- `src/components/students/{StudentFormDialog,StudentDetailPanel}.tsx`
- `src/hooks/useStudentAppStats.ts`
- `src/features/students/constants.ts`
- `src/hooks/useStudents.ts` (select payment columns)

## Database
No new migration. Payment columns use Phase 4 SQL when applied; otherwise UI falls back gracefully.

## Next
Phase 7: Placement page
