-- 0024_message_thread_lifecycle_and_retention_rls_closure
--
-- Forward RLS for the three relations that platform 0025 creates for conversation lifecycle, retention and read state.
-- All are direct-org tenant tables and reuse ue_create_direct_org_rls_policy from 0010. This migration does not grant
-- DML. Exact privileges come from the storage-authority manifest at grant activation
-- (db/rls-storage-authority/communications-notifications.ts). 0014 through 0023 are not modified.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0024 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  FOREACH t IN ARRAY ARRAY['message_thread_lifecycle', 'message_retention_policies', 'message_thread_reads'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0024 fail-closed: public.% does not exist (platform 0025 not applied).', t;
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
      RAISE EXCEPTION 'RLS 0024 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass
        AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0024 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('message_thread_lifecycle');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('message_retention_policies');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('message_thread_reads');
