# Phase 5 — Employees page

## Completed
- `/admin/employees` live against production Supabase
- Search, status filters (All / Active / Inactive), sortable columns, pagination
- Compact table: employee, category, assigned count, apps today, progress vs daily target, account status, welcome email
- Add / edit employee (edge `manage-employee` + optional welcome email)
- Per-employee **daily target** editor (writes `daily_target` when column exists)
- Detail panel: joining/last-active, assign/unassign students
- Activate / deactivate with confirmation
- Reset password + email; resend welcome credentials

## Files
- `src/pages/admin/EmployeesPage.tsx`
- `src/components/employees/*`
- `src/hooks/{useEmployees,useStudents,useEmailLogs,useEmployeeAppsToday}.ts`
- `src/lib/sendWelcomeCredentials.ts`
- `src/features/employees/constants.ts`

## Database
No new migration in this phase. Uses existing tables + optional Phase 4 columns with fallbacks.

## Next
Phase 6: Students management page
