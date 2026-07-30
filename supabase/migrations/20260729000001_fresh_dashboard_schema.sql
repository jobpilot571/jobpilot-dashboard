-- ═══════════════════════════════════════════════════════════════════════════
-- Fresh JobPilot Dashboard schema for JoBPilot_HR (empty project only)
-- Project: coecxgpttnunopxgfxct
-- Run AFTER 20260729000000_wipe_public_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.app_role AS ENUM ('admin', 'employee', 'student');

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'student',
  must_change_password boolean NOT NULL DEFAULT false,
  temporary_password_active boolean NOT NULL DEFAULT false,
  password_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON public.users (lower(email));

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  job_role_category text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  daily_target integer NOT NULL DEFAULT 40 CHECK (daily_target > 0),
  joining_date date,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_email_lower_idx ON public.employees (lower(email));
CREATE INDEX employees_user_id_idx ON public.employees (user_id);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  program text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  last_assigned_to uuid,
  inactive_at timestamptz,
  inactive_reason text,
  applied_date date NOT NULL DEFAULT (timezone('America/Chicago', now()))::date,
  documents_submitted integer NOT NULL DEFAULT 0,
  documents_total integer NOT NULL DEFAULT 6,
  joining_date date,
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a')),
  payment_amount numeric(12, 2),
  payment_date date,
  payment_method text,
  payment_notes text,
  last_active_at timestamptz,
  profile_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX students_email_lower_idx ON public.students (lower(email));
CREATE INDEX students_assigned_to_idx ON public.students (assigned_to);
CREATE INDEX students_user_id_idx ON public.students (user_id);

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  created_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  company_name text NOT NULL DEFAULT '',
  job_role text NOT NULL DEFAULT '',
  applied_link text NOT NULL DEFAULT '',
  applied_date text NOT NULL DEFAULT '',
  applied_time text NOT NULL DEFAULT '',
  applied_at timestamptz NOT NULL DEFAULT now(),
  serial_no integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Applied',
  resume_file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_applications_student_id_idx ON public.job_applications (student_id);
CREATE INDEX job_applications_applied_at_idx ON public.job_applications (applied_at DESC);

CREATE TABLE public.placement_pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  stage text NOT NULL,
  company_name text,
  job_role text,
  event_link text,
  recruiter_name text,
  recruiter_email text,
  phone_number text,
  event_date text,
  event_time text,
  due_date text,
  status text,
  result text,
  completed boolean DEFAULT false,
  salary_or_rate text,
  employment_type text,
  joining_date text,
  interview_mode text,
  interviewer_name text,
  panel_members text,
  screenshot_url text,
  document_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX placement_events_student_id_idx ON public.placement_pipeline_events (student_id);
CREATE INDEX placement_events_stage_idx ON public.placement_pipeline_events (stage);

CREATE TABLE public.trial_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  target_role text NOT NULL DEFAULT '',
  visa_status text NOT NULL DEFAULT '',
  signup_date date NOT NULL DEFAULT (timezone('America/Chicago', now()))::date,
  trial_end_date date NOT NULL,
  trial_status text NOT NULL DEFAULT 'active',
  assigned_to uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  assigned_at timestamptz,
  resume_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trial_students_email_lower_idx ON public.trial_students (lower(email));

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  email_type text NOT NULL DEFAULT 'general',
  subject text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  provider_message_id text,
  role text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.application_detail_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  application_details_id uuid,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  status text NOT NULL DEFAULT 'uploaded',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Role helpers
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE id = _user_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_active_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.employees WHERE user_id = _user_id AND status = 'active'); $$;

CREATE OR REPLACE FUNCTION public.is_active_student(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.students
  WHERE user_id = _user_id AND status IN ('active', 'pending', 'assigned')
); $$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_student_ids_for_user(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
  FROM public.students s
  JOIN public.employees e ON e.id = s.assigned_to
  WHERE e.user_id = _user_id;
$$;

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
  COALESCE(p.offer_count, 0)::bigint AS offer_count,
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
    count(*) FILTER (WHERE pe.stage = 'screening')::bigint AS screening_count,
    count(*) FILTER (WHERE pe.stage = 'technical')::bigint AS technical_count,
    count(*) FILTER (WHERE pe.stage = 'panel')::bigint AS panel_count,
    count(*) FILTER (WHERE pe.stage = 'offer')::bigint AS offer_count,
    max(pe.created_at) AS last_pipeline_at,
    max(pe.created_at) FILTER (WHERE pe.stage IN ('screening', 'technical', 'panel', 'offer')) AS last_interview_offer_at,
    max(pe.created_at) FILTER (WHERE pe.stage IN ('assessment', 'screening')) AS last_early_stage_at
  FROM public.placement_pipeline_events pe WHERE pe.student_id = s.id
) p ON true;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_detail_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY users_update_own_or_admin ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR id = auth.uid());

CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY employees_write_admin ON public.employees
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY students_select ON public.students
  FOR SELECT TO authenticated USING (
    public.is_admin() OR user_id = auth.uid() OR assigned_to = public.current_employee_id()
  );
CREATE POLICY students_write_admin ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin() OR assigned_to = public.current_employee_id())
  WITH CHECK (public.is_admin() OR assigned_to = public.current_employee_id());

CREATE POLICY job_apps_select ON public.job_applications
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );
CREATE POLICY job_apps_write ON public.job_applications
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
  )
  WITH CHECK (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
  );

CREATE POLICY pipeline_select ON public.placement_pipeline_events
  FOR SELECT TO authenticated USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );
CREATE POLICY pipeline_write ON public.placement_pipeline_events
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
  )
  WITH CHECK (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
  );

CREATE POLICY trials_select ON public.trial_students
  FOR SELECT TO authenticated USING (
    public.is_admin() OR assigned_to = public.current_employee_id()
  );
CREATE POLICY trials_write_admin ON public.trial_students
  FOR ALL TO authenticated
  USING (public.is_admin() OR assigned_to = public.current_employee_id())
  WITH CHECK (public.is_admin() OR assigned_to = public.current_employee_id());

CREATE POLICY email_logs_admin ON public.email_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY app_docs_access ON public.application_detail_documents
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY resumes_select ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'resumes');
CREATE POLICY resumes_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (public.is_admin() OR public.current_employee_id() IS NOT NULL));
CREATE POLICY resumes_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (public.is_admin() OR public.current_employee_id() IS NOT NULL));
CREATE POLICY resumes_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'resumes' AND public.is_admin());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.student_placement_summary TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
