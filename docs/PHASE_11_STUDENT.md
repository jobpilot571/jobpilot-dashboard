# Phase 11 — Student portal

## Completed
- Full `/me/*` student portal against live Supabase
- Resolve current student via `students.user_id` (email fallback + link)
- **Dashboard** — coordinator card / pending banner, apps KPIs, documents progress, recent apps
- **Progress** — application status + placement pipeline breakdowns
- **History** — read-only applications with date/status/search filters
- **Profile** — account fields, resume `profile_json` summary when present, change password
- **Documents** — completion bar, required-doc checklist vs `application_detail_documents`, uploaded list
- **Out of v1 (flags off):** Application Details token form, Trial Chat, Resume Enhancer

## Files
- `src/hooks/useCurrentStudent.ts`
- `src/hooks/useStudentPortal.ts`
- `src/features/documents/constants.ts`
- `src/components/student/NoStudentProfile.tsx`
- `src/pages/student/{Dashboard,Progress,History,Profile,Documents}Page.tsx`
- `src/lib/students.ts` (`profile_json` on type)

## DB
No schema changes.

## Tested
- `npm run build`

## Next
Cutover ops: apply migration + follow `docs/CUTOVER.md`

## Break risk
Low–medium — read-heavy. Document checklist depends on RLS allowing students to read `application_detail_documents`. Secure self-upload remains deferred with `appDetailsModule`.
