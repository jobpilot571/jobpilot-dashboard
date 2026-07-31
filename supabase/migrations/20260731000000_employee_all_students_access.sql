-- All-students access for selected employees (not admin).
-- Grants student/app/pipeline visibility without promoting to admin.
-- NOTE: live DB get_student_ids_for_user returns SETOF uuid (not uuid[]).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS can_access_all_students boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.employee_sees_all_students()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.status = 'active'
      AND e.can_access_all_students = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_student_ids_for_user(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = _user_id
      AND e.status = 'active'
      AND e.can_access_all_students = true
  ) THEN
    RETURN QUERY SELECT s.id FROM public.students s;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id
  FROM public.students s
  JOIN public.employees e ON e.id = s.assigned_to
  WHERE e.user_id = _user_id;
END;
$$;

DROP POLICY IF EXISTS students_select ON public.students;
CREATE POLICY students_select ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  );

DROP POLICY IF EXISTS students_write_admin ON public.students;
CREATE POLICY students_write_admin ON public.students
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  )
  WITH CHECK (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  );

DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.employee_sees_all_students()
  );

DROP POLICY IF EXISTS trials_select ON public.trial_students;
CREATE POLICY trials_select ON public.trial_students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  );

DROP POLICY IF EXISTS trials_write_admin ON public.trial_students;
CREATE POLICY trials_write_admin ON public.trial_students
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  )
  WITH CHECK (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
    OR public.employee_sees_all_students()
  );

UPDATE public.employees
SET can_access_all_students = true
WHERE lower(email) = lower('charansaiss17@gmail.com');
