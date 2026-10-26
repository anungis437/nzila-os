-- 0021_message_thread_triage_rls_closure
--
-- Forward RLS for the two relations that platform 0014 creates for staff assignment of member
-- conversations. Both are direct-org tenant tables and reuse ue_create_direct_org_rls_policy from
-- 0010. This migration does not grant DML; exact privileges come from the storage-authority
-- manifest at grant activation (db/rls-storage-authority/communications-notifications.ts).
-- 0014 through 0020 are not modified.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0021 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  FOREACH t IN ARRAY ARRAY['triage_designations', 'message_thread_assignments'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0021 fail-closed: public.% does not exist (platform 0014 not applied).', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'organization_id'
        AND udt_name = 'uuid'
        AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0021 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass
        AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0021 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('triage_designations');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('message_thread_assignments');
