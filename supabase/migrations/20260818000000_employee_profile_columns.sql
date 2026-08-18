-- Live employees table was missing daily_target / joining_date / last_active_at.
-- The app select includes those columns, then falls back and previously dropped
-- Team Lead flags. Add the expected columns so full selects succeed.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS daily_target integer NOT NULL DEFAULT 40;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS joining_date date;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_daily_target_check'
      AND conrelid = 'public.employees'::regclass
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_daily_target_check CHECK (daily_target > 0);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
