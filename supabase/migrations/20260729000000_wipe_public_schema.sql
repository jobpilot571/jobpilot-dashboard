-- ═══════════════════════════════════════════════════════════════════════════
-- DANGER: Wipes ALL objects in public schema on JoBPilot_HR
-- Project: coecxgpttnunopxgfxct
-- This DELETES every public table, view, function, and custom type.
-- Auth users in Authentication tab are NOT deleted here (clear those separately
-- if you want a completely empty project).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop all views in public
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
  END LOOP;
END $$;

-- Drop all tables in public
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END $$;

-- Drop all functions in public (except extension-owned if any fail, skip)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Drop custom enum/types in public
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Clear dashboard storage bucket if present
DELETE FROM storage.objects WHERE bucket_id = 'resumes';
DELETE FROM storage.buckets WHERE id = 'resumes';

COMMIT;

-- Optional: also wipe Auth users via Dashboard → Authentication → Users
-- or run carefully (uncomment only if you want zero auth users):
-- DELETE FROM auth.users;
