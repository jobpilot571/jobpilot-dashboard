-- Student portal RLS depends on get_student_ids_for_user(auth.uid()).
-- The previous definition only returned students assigned to an employee
-- (or all students for can_access_all_students). Logged-in students got
-- an empty set → job_applications / documents / details all appeared as 0.

CREATE OR REPLACE FUNCTION public.get_student_ids_for_user(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- All-students counselor access
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

  -- Student's own profile (student portal)
  RETURN QUERY
  SELECT s.id
  FROM public.students s
  WHERE s.user_id = _user_id;

  -- Employees: assigned students
  RETURN QUERY
  SELECT s.id
  FROM public.students s
  JOIN public.employees e ON e.id = s.assigned_to
  WHERE e.user_id = _user_id;
END;
$$;

-- Students could not read placement_pipeline_events at all (admin/employee only).
DROP POLICY IF EXISTS "Students can read own pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Students can read own pipeline events"
  ON public.placement_pipeline_events
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'student'::app_role
    AND student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  );
