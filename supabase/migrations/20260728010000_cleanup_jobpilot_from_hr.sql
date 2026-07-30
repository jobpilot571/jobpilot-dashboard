-- REVERT JoBPilot_HR → remove JobPilot Dashboard objects only
-- Project: JoBPilot_HR (coecxgpttnunopxgfxct)
-- Run ALL of this in Supabase → SQL Editor → Run
--
-- Goal: leave original HR tables; strip dashboard tables/columns we added.

BEGIN;

-- ========== Policies we created ==========
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
DROP POLICY IF EXISTS users_update_own_or_admin ON public.users;
DROP POLICY IF EXISTS users_insert_admin ON public.users;
DROP POLICY IF EXISTS employees_select ON public.employees;
DROP POLICY IF EXISTS employees_write_admin ON public.employees;
DROP POLICY IF EXISTS students_select ON public.students;
DROP POLICY IF EXISTS students_write_admin ON public.students;
DROP POLICY IF EXISTS job_apps_select ON public.job_applications;
DROP POLICY IF EXISTS job_apps_write ON public.job_applications;
DROP POLICY IF EXISTS pipeline_select ON public.placement_pipeline_events;
DROP POLICY IF EXISTS pipeline_write ON public.placement_pipeline_events;
DROP POLICY IF EXISTS trials_select ON public.trial_students;
DROP POLICY IF EXISTS trials_write_admin ON public.trial_students;
DROP POLICY IF EXISTS email_logs_admin ON public.email_logs;
DROP POLICY IF EXISTS app_docs_access ON public.application_detail_documents;
DROP POLICY IF EXISTS resumes_select ON storage.objects;
DROP POLICY IF EXISTS resumes_insert ON storage.objects;
DROP POLICY IF EXISTS resumes_update ON storage.objects;
DROP POLICY IF EXISTS resumes_delete ON storage.objects;

-- ========== Dashboard view + functions ==========
DROP VIEW IF EXISTS public.student_placement_summary CASCADE;

DROP FUNCTION IF EXISTS public.get_student_ids_for_user(uuid);
DROP FUNCTION IF EXISTS public.current_employee_id();
DROP FUNCTION IF EXISTS public.is_active_student(uuid);
DROP FUNCTION IF EXISTS public.is_active_employee(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- ========== Dashboard-only tables (safe to drop) ==========
DROP TABLE IF EXISTS public.application_detail_documents CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.job_applications CASCADE;
DROP TABLE IF EXISTS public.placement_pipeline_events CASCADE;
DROP TABLE IF EXISTS public.trial_students CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ========== Storage bucket we added ==========
DELETE FROM storage.objects WHERE bucket_id = 'resumes';
DELETE FROM storage.buckets WHERE id = 'resumes';

-- ========== Strip columns we ADDED onto existing public.employees ==========
-- Original HR employees had NO "email" (first migration failed on that).
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_daily_target_check;
DROP INDEX IF EXISTS public.employees_email_lower_idx;
DROP INDEX IF EXISTS public.employees_user_id_idx;

ALTER TABLE public.employees DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.employees DROP COLUMN IF EXISTS email;
ALTER TABLE public.employees DROP COLUMN IF EXISTS job_role_category;
ALTER TABLE public.employees DROP COLUMN IF EXISTS avatar;
ALTER TABLE public.employees DROP COLUMN IF EXISTS daily_target;
ALTER TABLE public.employees DROP COLUMN IF EXISTS joining_date;
ALTER TABLE public.employees DROP COLUMN IF EXISTS last_active_at;
ALTER TABLE public.employees DROP COLUMN IF EXISTS updated_at;

-- These MAY have been original HR columns. Drop only if they were added by us
-- and HR breaks without the old shape. Uncomment if your HR app errors on them:
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS name;
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS role;
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS created_at;

-- ========== Enum only used by dashboard users.role ==========
-- Keep if something else uses it; otherwise drop:
DROP TYPE IF EXISTS public.app_role CASCADE;

COMMIT;

-- Verify remaining public tables:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
-- ORDER BY 1;
--
-- Verify employees columns:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'employees'
-- ORDER BY ordinal_position;
