-- Placement board: admin-only deletes, student screenshot uploads, HR + rejected counts.

-- Employees/team leads can insert/update, but only admins can delete pipeline cards.
DROP POLICY IF EXISTS pipeline_write ON public.placement_pipeline_events;
DROP POLICY IF EXISTS "Elevated employees delete pipeline events" ON public.placement_pipeline_events;

DROP POLICY IF EXISTS pipeline_insert ON public.placement_pipeline_events;
CREATE POLICY pipeline_insert ON public.placement_pipeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS pipeline_update ON public.placement_pipeline_events;
CREATE POLICY pipeline_update ON public.placement_pipeline_events
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR student_id IN (SELECT public.get_student_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS pipeline_delete_admin ON public.placement_pipeline_events;
CREATE POLICY pipeline_delete_admin ON public.placement_pipeline_events
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Students can upload forwarded-email screenshots into screenshots/{theirStudentId}/...
DROP POLICY IF EXISTS resumes_insert ON storage.objects;
CREATE POLICY resumes_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (
      public.is_admin()
      OR public.current_employee_id() IS NOT NULL
      OR (
        name LIKE 'screenshots/%'
        AND split_part(name, '/', 2) IN (
          SELECT s.id::text FROM public.students s WHERE s.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS resumes_update ON storage.objects;
CREATE POLICY resumes_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      public.is_admin()
      OR public.current_employee_id() IS NOT NULL
      OR (
        name LIKE 'screenshots/%'
        AND split_part(name, '/', 2) IN (
          SELECT s.id::text FROM public.students s WHERE s.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'resumes'
    AND (
      public.is_admin()
      OR public.current_employee_id() IS NOT NULL
      OR (
        name LIKE 'screenshots/%'
        AND split_part(name, '/', 2) IN (
          SELECT s.id::text FROM public.students s WHERE s.user_id = auth.uid()
        )
      )
    )
  );

CREATE OR REPLACE VIEW public.student_placement_summary
WITH (security_invoker = true)
AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.email AS student_email,
  COALESCE(s.joining_date, s.applied_date)::text AS joined_date,
  s.status AS student_status,
  s.assigned_to AS assigned_employee_id,
  e.name AS employee_name,
  COALESCE(app.total_applications, 0)::bigint AS total_applications,
  app.last_application_at,
  COALESCE(p.assessment_count, 0)::bigint AS assessment_count,
  COALESCE(p.screening_count, 0)::bigint AS screening_count,
  COALESCE(p.technical_count, 0)::bigint AS technical_count,
  COALESCE(p.panel_count, 0)::bigint AS panel_count,
  COALESCE(p.hr_count, 0)::bigint AS hr_count,
  COALESCE(p.offer_count, 0)::bigint AS offer_count,
  COALESCE(p.rejected_count, 0)::bigint AS rejected_count,
  p.last_pipeline_at,
  p.last_interview_offer_at,
  p.last_early_stage_at,
  false AS has_overdue_assessment,
  false AS has_needs_update
FROM public.students s
LEFT JOIN public.employees e ON e.id = s.assigned_to
LEFT JOIN LATERAL (
  SELECT count(*)::bigint AS total_applications, max(ja.applied_at) AS last_application_at
  FROM public.job_applications ja WHERE ja.student_id = s.id
) app ON true
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE pe.stage = 'assessment')::bigint AS assessment_count,
    count(*) FILTER (WHERE pe.stage IN ('screening', 'ai_screening'))::bigint AS screening_count,
    count(*) FILTER (WHERE pe.stage = 'technical')::bigint AS technical_count,
    count(*) FILTER (WHERE pe.stage = 'panel')::bigint AS panel_count,
    count(*) FILTER (WHERE pe.stage = 'hr')::bigint AS hr_count,
    count(*) FILTER (WHERE pe.stage = 'offer')::bigint AS offer_count,
    count(*) FILTER (WHERE pe.stage = 'rejected')::bigint AS rejected_count,
    max(pe.created_at) AS last_pipeline_at,
    max(pe.created_at) FILTER (WHERE pe.stage IN ('screening', 'technical', 'panel', 'hr', 'offer')) AS last_interview_offer_at,
    max(pe.created_at) FILTER (WHERE pe.stage IN ('assessment', 'screening', 'ai_screening')) AS last_early_stage_at
  FROM public.placement_pipeline_events pe WHERE pe.student_id = s.id
) p ON true;
