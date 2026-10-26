-- 0020_authority_kernel_rls_closure
--
-- Forward RLS for the eight relations that platform 0013 creates for the
-- Institutional Authority Kernel. All are direct-org tenant tables and reuse
-- ue_create_direct_org_rls_policy from 0010, which enables and FORCES row level
-- security and creates the union_eyes_runtime policies. This migration does not
-- grant DML. Exact privileges come from the storage-authority manifest at grant
-- activation (db/rls-storage-authority/authority-kernel.ts).
-- 0014 through 0019 are not modified.

DO $$
DECLARE
  t text;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0020 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'ue_authority_mandates',
    'ue_authority_resource_relationships',
    'ue_authority_delegations',
    'ue_authority_recusals',
    'ue_authority_disclosure_consents',
    'ue_authority_approval_requests',
    'ue_authority_approval_decisions',
    'ue_authority_events',
    'ue_authority_issuance_rules',
    'ue_authority_acceptances',
    'ue_authority_requests',
    'ue_authority_financial_steps',
    'ue_authority_reviews',
    'ue_authority_workaid_matters',
    'ue_authority_counsel_engagements',
    'ue_authority_counsel_nonces'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0020 fail-closed: public.% does not exist (platform 0013 not applied).', t;
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
      RAISE EXCEPTION 'RLS 0020 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', t)::regclass
        AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0020 fail-closed: public.% is owned by a runtime role.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_mandates');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_resource_relationships');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_delegations');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_recusals');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_disclosure_consents');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_approval_requests');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_approval_decisions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_issuance_rules');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_acceptances');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_requests');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_financial_steps');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_reviews');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_workaid_matters');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_counsel_engagements');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ue_authority_counsel_nonces');
