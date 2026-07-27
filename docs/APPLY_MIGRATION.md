# Apply additive migration (manual)

There is no database password / service role in this workspace, so the migration is **not** applied automatically.

## File
`supabase/migrations/20260723200000_employee_targets_and_student_payment.sql`

## What it adds
**employees:** `daily_target` (default 40), `joining_date`, `last_active_at`, `updated_at`  
**students:** `joining_date`, `payment_status` (+ amount/date/method/notes), `last_active_at`  
Best-effort: trial-linked students → `payment_status = 'n/a'`

Placement stage keys are **not** renamed.

## Before you apply
1. Open Supabase Dashboard → Project `yvhayaaghhthlgwtgveh`
2. Create a backup / note PITR time
3. Open **SQL Editor**

## Apply
Paste and run the migration SQL.

## After
1. Confirm employee columns: `daily_target`, `joining_date`, `last_active_at`
2. Confirm student columns: `payment_*`, `joining_date`
3. Refresh Admin Dashboard — “migration pending” alert should clear
4. Optionally regenerate types: `npx supabase gen types typescript --project-id yvhayaaghhthlgwtgveh > src/integrations/supabase/types.ts`

## Safe without migration
The rebuild already works against live data. Until applied it falls back to **daily target = 40** and skips payment columns via `isMissingColumnError` selects.
