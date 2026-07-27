-- Phase 3 additive migration (NOT APPLIED YET).
-- Apply only after production backup and explicit approval.
--
-- Goals:
-- 1) Per-employee daily_target (default 40)
-- 2) Employee joining_date / last_active_at
-- 3) Student joining_date, payment_status + separate payment fields
--
-- Placement stage keys are intentionally NOT renamed.

-- employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS daily_target integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.employees.daily_target IS 'Per-employee daily application target; default 40';

-- Backfill joining_date from created_at where missing
UPDATE public.employees
SET joining_date = (created_at AT TIME ZONE 'America/Chicago')::date
WHERE joining_date IS NULL AND created_at IS NOT NULL;

-- students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_payment_status_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a'));

COMMENT ON COLUMN public.students.payment_status IS 'unpaid | partial | paid | waived | n/a';
COMMENT ON COLUMN public.students.payment_amount IS 'Separate from status; nullable';
COMMENT ON COLUMN public.students.payment_date IS 'Date payment was received/recorded';
COMMENT ON COLUMN public.students.payment_method IS 'e.g. card, bank, cash, other';
COMMENT ON COLUMN public.students.payment_notes IS 'Free-form payment notes';

UPDATE public.students
SET joining_date = COALESCE(
  joining_date,
  applied_date::date,
  (created_at AT TIME ZONE 'America/Chicago')::date
)
WHERE joining_date IS NULL;

-- Free-trial linked students: payment not applicable (best-effort by email match)
UPDATE public.students s
SET payment_status = 'n/a'
FROM public.trial_students t
WHERE lower(s.email) = lower(t.email)
  AND s.payment_status = 'unpaid'
  AND t.trial_status IS DISTINCT FROM 'converted';

-- Optional: ensure employees.daily_target stays positive
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_daily_target_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_daily_target_check
  CHECK (daily_target > 0);
