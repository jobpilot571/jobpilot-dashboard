-- Team Lead access: operate on all students and all employees without becoming admin.
-- Stays users.role = 'employee' so they remain on /app (not /admin settings/trials).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_team_lead boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.employee_is_team_lead()
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
      AND e.is_team_lead = true
  );
$$;

-- All-students visibility also applies to team leads
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
      AND (
        COALESCE(e.can_access_all_students, false) = true
        OR e.is_team_lead = true
      )
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
      AND (
        COALESCE(e.can_access_all_students, false) = true
        OR e.is_team_lead = true
      )
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

-- Additive policies (OR'd with existing admin/employee policies)
DROP POLICY IF EXISTS "Team leads can select employees" ON public.employees;
CREATE POLICY "Team leads can select employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (public.employee_is_team_lead());

DROP POLICY IF EXISTS "Team leads can insert employees" ON public.employees;
CREATE POLICY "Team leads can insert employees"
  ON public.employees
  FOR INSERT
  TO authenticated
  WITH CHECK (public.employee_is_team_lead());

DROP POLICY IF EXISTS "Team leads can update employees" ON public.employees;
CREATE POLICY "Team leads can update employees"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (public.employee_is_team_lead())
  WITH CHECK (public.employee_is_team_lead());

DROP POLICY IF EXISTS "Team leads can delete employees" ON public.employees;
CREATE POLICY "Team leads can delete employees"
  ON public.employees
  FOR DELETE
  TO authenticated
  USING (public.employee_is_team_lead());

-- Team leads can edit employees but cannot grant/revoke elevated flags (admin only)
CREATE OR REPLACE FUNCTION public.guard_employee_elevated_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_team_lead := false;
      NEW.can_access_all_students := COALESCE(NEW.can_access_all_students, false);
      -- Non-admins creating employees never start as team lead
      NEW.is_team_lead := false;
      NEW.can_access_all_students := false;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.is_team_lead := OLD.is_team_lead;
      NEW.can_access_all_students := OLD.can_access_all_students;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_elevated_flags ON public.employees;
CREATE TRIGGER trg_guard_employee_elevated_flags
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_employee_elevated_flags();

-- Elevated employees (all-students / team lead) — apps & pipeline beyond assigned-only policies
DROP POLICY IF EXISTS "Elevated employees select job applications" ON public.job_applications;
CREATE POLICY "Elevated employees select job applications"
  ON public.job_applications FOR SELECT TO authenticated
  USING (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees insert job applications" ON public.job_applications;
CREATE POLICY "Elevated employees insert job applications"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees update job applications" ON public.job_applications;
CREATE POLICY "Elevated employees update job applications"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (public.employee_sees_all_students())
  WITH CHECK (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees delete job applications" ON public.job_applications;
CREATE POLICY "Elevated employees delete job applications"
  ON public.job_applications FOR DELETE TO authenticated
  USING (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees select pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Elevated employees select pipeline events"
  ON public.placement_pipeline_events FOR SELECT TO authenticated
  USING (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees insert pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Elevated employees insert pipeline events"
  ON public.placement_pipeline_events FOR INSERT TO authenticated
  WITH CHECK (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees update pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Elevated employees update pipeline events"
  ON public.placement_pipeline_events FOR UPDATE TO authenticated
  USING (public.employee_sees_all_students())
  WITH CHECK (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees delete pipeline events" ON public.placement_pipeline_events;
CREATE POLICY "Elevated employees delete pipeline events"
  ON public.placement_pipeline_events FOR DELETE TO authenticated
  USING (public.employee_sees_all_students());

DROP POLICY IF EXISTS "Elevated employees manage job actions" ON public.job_actions;
CREATE POLICY "Elevated employees manage job actions"
  ON public.job_actions FOR ALL TO authenticated
  USING (public.employee_sees_all_students())
  WITH CHECK (public.employee_sees_all_students());

-- Ensure students policies recognize team leads via employee_sees_all_students()
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
