-- JobPilot core schema for JoBPilot_HR (coecxgpttnunopxgfxct)
-- Idempotent: creates missing tables AND adds missing columns on existing ones.
-- Apply in Supabase Dashboard → SQL Editor (entire file).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'employee', 'student');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'student',
  must_change_password boolean NOT NULL DEFAULT false,
  temporary_password_active boolean NOT NULL DEFAULT false,
  password_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role public.app_role;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temporary_password_active boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.users SET email = COALESCE(email, '') WHERE email IS NULL;
UPDATE public.users SET role = 'student'::public.app_role WHERE role IS NULL;
UPDATE public.users SET must_change_password = false WHERE must_change_password IS NULL;
UPDATE public.users SET temporary_password_active = false WHERE temporary_password_active IS NULL;
UPDATE public.users SET created_at = now() WHERE created_at IS NULL;

ALTER TABLE public.users ALTER COLUMN email SET DEFAULT '';
ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'student'::public.app_role;
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN must_change_password SET DEFAULT false;
ALTER TABLE public.users ALTER COLUMN must_change_password SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN temporary_password_active SET DEFAULT false;
ALTER TABLE public.users ALTER COLUMN temporary_password_active SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.users ALTER COLUMN created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (lower(email));

-- ---------------------------------------------------------------------------
-- employees (may already exist in JoBPilot_HR with a different shape)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_role_category text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS daily_target integer;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill defaults before NOT NULL
UPDATE public.employees SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.employees SET name = COALESCE(name, 'Unknown') WHERE name IS NULL;
UPDATE public.employees SET email = COALESCE(email, id::text || '@placeholder.local') WHERE email IS NULL OR email = '';
UPDATE public.employees SET role = COALESCE(NULLIF(role, ''), 'employee') WHERE role IS NULL OR role = '';
UPDATE public.employees SET job_role_category = COALESCE(job_role_category, '') WHERE job_role_category IS NULL;
UPDATE public.employees SET avatar = COALESCE(avatar, '') WHERE avatar IS NULL;
UPDATE public.employees SET status = COALESCE(NULLIF(status, ''), 'active') WHERE status IS NULL OR status = '';
UPDATE public.employees SET daily_target = COALESCE(daily_target, 40) WHERE daily_target IS NULL;
UPDATE public.employees SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;
UPDATE public.employees SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_pkey'
  ) THEN
    ALTER TABLE public.employees ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- already has a PK or incompatible
END $$;

ALTER TABLE public.employees ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.employees ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN email SET DEFAULT '';
ALTER TABLE public.employees ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE public.employees ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN job_role_category SET DEFAULT '';
ALTER TABLE public.employees ALTER COLUMN job_role_category SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN avatar SET DEFAULT '';
ALTER TABLE public.employees ALTER COLUMN avatar SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.employees ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN daily_target SET DEFAULT 40;
ALTER TABLE public.employees ALTER COLUMN daily_target SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.employees ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.employees ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_daily_target_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_daily_target_check CHECK (daily_target > 0);

CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_idx ON public.employees (lower(email));
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees (user_id);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS program text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_assigned_to uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS inactive_at timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS inactive_reason text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS applied_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS documents_submitted integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS documents_total integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS joining_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_amount numeric(12, 2);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_notes text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS profile_json jsonb;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.students SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.students SET name = COALESCE(name, 'Unknown') WHERE name IS NULL;
UPDATE public.students SET email = COALESCE(email, id::text || '@placeholder.local') WHERE email IS NULL OR email = '';
UPDATE public.students SET phone = COALESCE(phone, '') WHERE phone IS NULL;
UPDATE public.students SET program = COALESCE(program, '') WHERE program IS NULL;
UPDATE public.students SET status = COALESCE(NULLIF(status, ''), 'pending') WHERE status IS NULL OR status = '';
UPDATE public.students SET applied_date = COALESCE(applied_date, (timezone('America/Chicago', now()))::date) WHERE applied_date IS NULL;
UPDATE public.students SET documents_submitted = COALESCE(documents_submitted, 0) WHERE documents_submitted IS NULL;
UPDATE public.students SET documents_total = COALESCE(documents_total, 6) WHERE documents_total IS NULL;
UPDATE public.students SET payment_status = COALESCE(NULLIF(payment_status, ''), 'unpaid') WHERE payment_status IS NULL OR payment_status = '';
UPDATE public.students SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;

ALTER TABLE public.students ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.students ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN email SET DEFAULT '';
ALTER TABLE public.students ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE public.students ALTER COLUMN phone SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN program SET DEFAULT '';
ALTER TABLE public.students ALTER COLUMN program SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.students ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN applied_date SET DEFAULT (timezone('America/Chicago', now()))::date;
ALTER TABLE public.students ALTER COLUMN applied_date SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN documents_submitted SET DEFAULT 0;
ALTER TABLE public.students ALTER COLUMN documents_submitted SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN documents_total SET DEFAULT 6;
ALTER TABLE public.students ALTER COLUMN documents_total SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN payment_status SET DEFAULT 'unpaid';
ALTER TABLE public.students ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.students ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_payment_status_check;
ALTER TABLE public.students ADD CONSTRAINT students_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'waived', 'n/a'));

CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_idx ON public.students (lower(email));
CREATE INDEX IF NOT EXISTS students_assigned_to_idx ON public.students (assigned_to);
CREATE INDEX IF NOT EXISTS students_user_id_idx ON public.students (user_id);

-- ---------------------------------------------------------------------------
-- job_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS created_by_employee_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_role text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applied_link text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applied_date text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applied_time text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS serial_no integer;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS resume_file_url text;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.job_applications SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.job_applications SET company_name = COALESCE(company_name, '') WHERE company_name IS NULL;
UPDATE public.job_applications SET job_role = COALESCE(job_role, '') WHERE job_role IS NULL;
UPDATE public.job_applications SET applied_link = COALESCE(applied_link, '') WHERE applied_link IS NULL;
UPDATE public.job_applications SET applied_date = COALESCE(applied_date, '') WHERE applied_date IS NULL;
UPDATE public.job_applications SET applied_time = COALESCE(applied_time, '') WHERE applied_time IS NULL;
UPDATE public.job_applications SET applied_at = COALESCE(applied_at, now()) WHERE applied_at IS NULL;
UPDATE public.job_applications SET serial_no = COALESCE(serial_no, 0) WHERE serial_no IS NULL;
UPDATE public.job_applications SET status = COALESCE(status, 'Applied') WHERE status IS NULL;
UPDATE public.job_applications SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;

ALTER TABLE public.job_applications ALTER COLUMN company_name SET DEFAULT '';
ALTER TABLE public.job_applications ALTER COLUMN company_name SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN job_role SET DEFAULT '';
ALTER TABLE public.job_applications ALTER COLUMN job_role SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN applied_link SET DEFAULT '';
ALTER TABLE public.job_applications ALTER COLUMN applied_link SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN applied_date SET DEFAULT '';
ALTER TABLE public.job_applications ALTER COLUMN applied_date SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN applied_time SET DEFAULT '';
ALTER TABLE public.job_applications ALTER COLUMN applied_time SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN applied_at SET DEFAULT now();
ALTER TABLE public.job_applications ALTER COLUMN applied_at SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN serial_no SET DEFAULT 0;
ALTER TABLE public.job_applications ALTER COLUMN serial_no SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN status SET DEFAULT 'Applied';
ALTER TABLE public.job_applications ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.job_applications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.job_applications ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS job_applications_student_id_idx ON public.job_applications (student_id);
CREATE INDEX IF NOT EXISTS job_applications_applied_at_idx ON public.job_applications (applied_at DESC);

-- ---------------------------------------------------------------------------
-- placement_pipeline_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.placement_pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS job_role text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS event_link text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS recruiter_name text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS recruiter_email text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS event_date text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS event_time text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS due_date text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS completed boolean;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS salary_or_rate text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS joining_date text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS interview_mode text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS interviewer_name text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS panel_members text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.placement_pipeline_events ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.placement_pipeline_events SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.placement_pipeline_events SET stage = COALESCE(stage, 'assessment') WHERE stage IS NULL;
UPDATE public.placement_pipeline_events SET completed = COALESCE(completed, false) WHERE completed IS NULL;
UPDATE public.placement_pipeline_events SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;
UPDATE public.placement_pipeline_events SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL;

ALTER TABLE public.placement_pipeline_events ALTER COLUMN stage SET NOT NULL;
ALTER TABLE public.placement_pipeline_events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.placement_pipeline_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.placement_pipeline_events ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.placement_pipeline_events ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS placement_events_student_id_idx ON public.placement_pipeline_events (student_id);
CREATE INDEX IF NOT EXISTS placement_events_stage_idx ON public.placement_pipeline_events (stage);

-- ---------------------------------------------------------------------------
-- trial_students
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trial_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS target_role text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS visa_status text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS signup_date date;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS trial_end_date date;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS trial_status text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.trial_students ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.trial_students SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.trial_students SET full_name = COALESCE(full_name, 'Unknown') WHERE full_name IS NULL;
UPDATE public.trial_students SET email = COALESCE(email, id::text || '@placeholder.local') WHERE email IS NULL OR email = '';
UPDATE public.trial_students SET phone = COALESCE(phone, '') WHERE phone IS NULL;
UPDATE public.trial_students SET target_role = COALESCE(target_role, '') WHERE target_role IS NULL;
UPDATE public.trial_students SET visa_status = COALESCE(visa_status, '') WHERE visa_status IS NULL;
UPDATE public.trial_students SET signup_date = COALESCE(signup_date, (timezone('America/Chicago', now()))::date) WHERE signup_date IS NULL;
UPDATE public.trial_students SET trial_end_date = COALESCE(trial_end_date, signup_date + 14) WHERE trial_end_date IS NULL;
UPDATE public.trial_students SET trial_status = COALESCE(NULLIF(trial_status, ''), 'active') WHERE trial_status IS NULL OR trial_status = '';
UPDATE public.trial_students SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;
UPDATE public.trial_students SET updated_at = COALESCE(updated_at, now()) WHERE updated_at IS NULL;

ALTER TABLE public.trial_students ALTER COLUMN full_name SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN phone SET DEFAULT '';
ALTER TABLE public.trial_students ALTER COLUMN phone SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN target_role SET DEFAULT '';
ALTER TABLE public.trial_students ALTER COLUMN target_role SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN visa_status SET DEFAULT '';
ALTER TABLE public.trial_students ALTER COLUMN visa_status SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN signup_date SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN trial_end_date SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN trial_status SET DEFAULT 'active';
ALTER TABLE public.trial_students ALTER COLUMN trial_status SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.trial_students ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.trial_students ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.trial_students ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS trial_students_email_lower_idx ON public.trial_students (lower(email));

-- ---------------------------------------------------------------------------
-- email_logs + application_detail_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.email_logs SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.email_logs SET email = COALESCE(email, '') WHERE email IS NULL;
UPDATE public.email_logs SET email_type = COALESCE(email_type, 'general') WHERE email_type IS NULL;
UPDATE public.email_logs SET status = COALESCE(status, 'queued') WHERE status IS NULL;
UPDATE public.email_logs SET created_at = COALESCE(created_at, now()) WHERE created_at IS NULL;

ALTER TABLE public.email_logs ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN email_type SET DEFAULT 'general';
ALTER TABLE public.email_logs ALTER COLUMN email_type SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE public.email_logs ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.email_logs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.email_logs ALTER COLUMN created_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.application_detail_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS application_details_id uuid;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE public.application_detail_documents ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;

UPDATE public.application_detail_documents SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.application_detail_documents SET document_type = COALESCE(document_type, 'other') WHERE document_type IS NULL;
UPDATE public.application_detail_documents SET file_name = COALESCE(file_name, 'file') WHERE file_name IS NULL;
UPDATE public.application_detail_documents SET file_path = COALESCE(file_path, '') WHERE file_path IS NULL;
UPDATE public.application_detail_documents SET file_size = COALESCE(file_size, 0) WHERE file_size IS NULL;
UPDATE public.application_detail_documents SET mime_type = COALESCE(mime_type, 'application/octet-stream') WHERE mime_type IS NULL;
UPDATE public.application_detail_documents SET status = COALESCE(status, 'uploaded') WHERE status IS NULL;
UPDATE public.application_detail_documents SET uploaded_at = COALESCE(uploaded_at, now()) WHERE uploaded_at IS NULL;

ALTER TABLE public.application_detail_documents ALTER COLUMN document_type SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN file_name SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN file_path SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN file_size SET DEFAULT 0;
ALTER TABLE public.application_detail_documents ALTER COLUMN file_size SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';
ALTER TABLE public.application_detail_documents ALTER COLUMN mime_type SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN status SET DEFAULT 'uploaded';
ALTER TABLE public.application_detail_documents ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.application_detail_documents ALTER COLUMN uploaded_at SET DEFAULT now();
ALTER TABLE public.application_detail_documents ALTER COLUMN uploaded_at SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_student(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE user_id = _user_id AND status IN ('active', 'pending', 'assigned')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_student_ids_for_user(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
  FROM public.students s
  JOIN public.employees e ON e.id = s.assigned_to
  WHERE e.user_id = _user_id;
$$;

-- ---------------------------------------------------------------------------
-- Placement summary view
-- ---------------------------------------------------------------------------
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
  SELECT
    count(*)::bigint AS total_applications,
    max(ja.applied_at) AS last_application_at
  FROM public.job_applications ja
  WHERE ja.student_id = s.id
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
  FROM public.placement_pipeline_events pe
  WHERE pe.student_id = s.id
) p ON true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_detail_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS users_update_own_or_admin ON public.users;
CREATE POLICY users_update_own_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS users_insert_admin ON public.users;
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS employees_write_admin ON public.employees;
CREATE POLICY employees_write_admin ON public.employees
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS students_select ON public.students;
CREATE POLICY students_select ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR assigned_to = public.current_employee_id()
  );

DROP POLICY IF EXISTS students_write_admin ON public.students;
CREATE POLICY students_write_admin ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin() OR assigned_to = public.current_employee_id())
  WITH CHECK (public.is_admin() OR assigned_to = public.current_employee_id());

DROP POLICY IF EXISTS job_apps_select ON public.job_applications;
CREATE POLICY job_apps_select ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS job_apps_write ON public.job_applications;
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

DROP POLICY IF EXISTS pipeline_select ON public.placement_pipeline_events;
CREATE POLICY pipeline_select ON public.placement_pipeline_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR student_id IN (SELECT unnest(public.get_student_ids_for_user(auth.uid())))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS pipeline_write ON public.placement_pipeline_events;
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

DROP POLICY IF EXISTS trials_select ON public.trial_students;
CREATE POLICY trials_select ON public.trial_students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR assigned_to = public.current_employee_id()
  );

DROP POLICY IF EXISTS trials_write_admin ON public.trial_students;
CREATE POLICY trials_write_admin ON public.trial_students
  FOR ALL TO authenticated
  USING (public.is_admin() OR assigned_to = public.current_employee_id())
  WITH CHECK (public.is_admin() OR assigned_to = public.current_employee_id());

DROP POLICY IF EXISTS email_logs_admin ON public.email_logs;
CREATE POLICY email_logs_admin ON public.email_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS app_docs_access ON public.application_detail_documents;
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

-- ---------------------------------------------------------------------------
-- Storage: resumes bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS resumes_select ON storage.objects;
CREATE POLICY resumes_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');

DROP POLICY IF EXISTS resumes_insert ON storage.objects;
CREATE POLICY resumes_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (public.is_admin() OR public.current_employee_id() IS NOT NULL));

DROP POLICY IF EXISTS resumes_update ON storage.objects;
CREATE POLICY resumes_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (public.is_admin() OR public.current_employee_id() IS NOT NULL));

DROP POLICY IF EXISTS resumes_delete ON storage.objects;
CREATE POLICY resumes_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.student_placement_summary TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
