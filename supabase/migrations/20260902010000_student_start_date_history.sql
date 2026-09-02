-- Audit log for student start-date changes (admin-only).

CREATE TABLE IF NOT EXISTS public.student_start_date_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  old_date date,
  new_date date,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text NOT NULL DEFAULT '',
  changed_by_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_start_date_history_student_idx
  ON public.student_start_date_history (student_id, created_at DESC);

COMMENT ON TABLE public.student_start_date_history IS
  'When a student start date was changed, by whom.';

ALTER TABLE public.student_start_date_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_start_date_history_admin_all ON public.student_start_date_history;
CREATE POLICY student_start_date_history_admin_all ON public.student_start_date_history
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.student_start_date_history TO authenticated;
