-- Allow "other" as an application source section.

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_application_source_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_application_source_check
  CHECK (application_source IN ('career_sites', 'jobright', 'dice', 'linkedin', 'other'));
