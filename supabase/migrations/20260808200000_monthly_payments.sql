-- Monthly student payments and employee salaries (admin-editable).

CREATE TABLE IF NOT EXISTS public.student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a')),
  payment_method text NOT NULL DEFAULT '',
  paid_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, year, month)
);

CREATE TABLE IF NOT EXISTS public.employee_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a')),
  payment_method text NOT NULL DEFAULT '',
  paid_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS student_payments_period_idx
  ON public.student_payments (year, month);
CREATE INDEX IF NOT EXISTS employee_salaries_period_idx
  ON public.employee_salaries (year, month);

ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_payments_admin_all ON public.student_payments;
CREATE POLICY student_payments_admin_all ON public.student_payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS employee_salaries_admin_all ON public.employee_salaries;
CREATE POLICY employee_salaries_admin_all ON public.employee_salaries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Backfill current month from students.payment_* snapshot when present
INSERT INTO public.student_payments (
  student_id, year, month, amount, status, payment_method, paid_at, notes
)
SELECT
  s.id,
  EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Chicago'))::int,
  EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))::int,
  COALESCE(s.payment_amount, 0),
  CASE
    WHEN s.payment_status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a') THEN s.payment_status
    ELSE 'unpaid'
  END,
  COALESCE(s.payment_method, ''),
  s.payment_date,
  COALESCE(s.payment_notes, '')
FROM public.students s
WHERE s.status IS DISTINCT FROM 'inactive'
ON CONFLICT (student_id, year, month) DO NOTHING;
