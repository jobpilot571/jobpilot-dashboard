-- Students can add/update their own forwarded pipeline events, but cannot delete.
-- Employees/admins keep existing write+delete policies.

DROP POLICY IF EXISTS "Students can insert own pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Students can insert own pipeline events"
  ON public.placement_pipeline_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.get_user_role(auth.uid()) = 'student'::app_role
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'student')
    )
    AND student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "Students can update own pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Students can update own pipeline events"
  ON public.placement_pipeline_events
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.get_user_role(auth.uid()) = 'student'::app_role
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'student')
    )
    AND student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    (
      public.get_user_role(auth.uid()) = 'student'::app_role
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'student')
    )
    AND student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  );

-- Explicitly do NOT grant students DELETE on placement_pipeline_events.
