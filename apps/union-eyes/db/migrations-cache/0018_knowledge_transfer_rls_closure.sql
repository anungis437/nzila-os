-- 0018_knowledge_transfer_rls_closure
--
-- Forward RLS for the three relations that platform 0012 now creates:
-- ue_cognition_memory, ue_reasoning_sessions and ue_copilot_conversations. All are direct-org tenant
-- tables. They reuse ue_create_direct_org_rls_policy from 0010, which enables
-- and FORCES row level security and creates the union_eyes_runtime policies.
-- This migration does not grant DML. Exact privileges come from the
-- storage-authority manifest at grant activation.
-- 0014 through 0017 are not modified.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ue_cognition_memory', 'ue_reasoning_sessions', 'ue_copilot_conversations'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0018 fail-closed: public.% does not exist.', t;
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
      RAISE EXCEPTION 'RLS 0018 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass
        AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0018 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_cognition_memory');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_reasoning_sessions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_copilot_conversations');
