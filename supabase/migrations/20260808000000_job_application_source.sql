-- Tag job applications by board/source so employees log links under Career sites,
-- Jobright.ai, Dice, or LinkedIn sections.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS application_source text NOT NULL DEFAULT 'career_sites';

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_application_source_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_application_source_check
  CHECK (application_source IN ('career_sites', 'jobright', 'dice', 'linkedin'));

CREATE INDEX IF NOT EXISTS job_applications_student_source_idx
  ON public.job_applications (student_id, application_source);
