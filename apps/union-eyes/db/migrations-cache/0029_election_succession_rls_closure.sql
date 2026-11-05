-- 0029_election_succession_rls_closure
--
-- FORCE RLS for the two relations that platform 0033 and 0034 create for council-election supersession:
-- election_certificate_successions and election_organization_ownership. Both are direct organization_id uuid
-- NOT NULL tenant tables and reuse ue_create_direct_org_rls_policy from 0010. This migration does not grant DML.
-- Exact privileges come from the storage-authority manifest (db/rls-storage-authority/authority-kernel.ts).
-- Without it the catalog preflight leaves both relations unclassified and runtime grant activation aborts.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0029 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  FOREACH t IN ARRAY ARRAY['election_certificate_successions', 'election_organization_ownership'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0029 fail-closed: public.% does not exist (platform 0033/0034 not applied).', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
        AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0029 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0029 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('election_certificate_successions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('election_organization_ownership');
