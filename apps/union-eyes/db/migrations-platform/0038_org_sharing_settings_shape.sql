-- PLATFORM_SQL 0038_org_sharing_settings_shape — UNQUALIFIED / NO APPLY
--
-- Only the thirteen missing declared columns on organization_sharing_settings.
-- A dormant Django stub became reachable from a tenant sharing API; migration
-- 0031 remains frozen at its independently reviewed four tables.
--
-- NO RLS, grants, indexes, constraints, FK, DROP or cross-tenant access changes.
-- Native PG15/16, pre/post grant/policy checks, ownership uniqueness and the
-- tenant runtime role are release blockers. Do not apply to any environment
-- until qualified under a separate approved database decision.
--
-- Requires one transaction for the entire migration; the temporary fingerprint
-- exists only in that transaction. Any type mismatch or row-ownership ambiguity
-- aborts before ALTER. No historical data is reattributed.
--> statement-breakpoint
DO $preflight$
DECLARE
  c record;
  actual_type text;
BEGIN
  IF to_regclass('public.organization_sharing_settings') IS NULL THEN
    RAISE EXCEPTION '0038 fail-closed: organization_sharing_settings is absent';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_sharing_settings WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION '0038 fail-closed: historical sharing record lacks an owner';
  END IF;
  IF EXISTS (
    SELECT organization_id FROM public.organization_sharing_settings
    GROUP BY organization_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0038 fail-closed: multiple sharing records per organization';
  END IF;

  FOR c IN SELECT * FROM (VALUES
    ('allow_congress_sharing', 'boolean'),
    ('allow_federation_sharing', 'boolean'),
    ('allow_province_sharing', 'boolean'),
    ('allow_sector_sharing', 'boolean'),
    ('allowed_sharing_levels', 'character varying(50)[]'),
    ('auto_share_clauses', 'boolean'),
    ('auto_share_precedents', 'boolean'),
    ('default_sharing_level', 'character varying(50)'),
    ('max_shared_clauses', 'integer'),
    ('max_shared_precedents', 'integer'),
    ('require_anonymization', 'boolean'),
    ('sharing_approval_required', 'boolean'),
    ('sharing_approver_role', 'character varying(50)')
  ) AS specs(column_name, expected_type)
  LOOP
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
      INTO actual_type
      FROM pg_attribute a
      JOIN pg_class t ON t.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'organization_sharing_settings'
       AND a.attname = c.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    IF FOUND AND actual_type IS DISTINCT FROM c.expected_type THEN
      RAISE EXCEPTION '0038 fail-closed: column % is %, expected %', c.column_name, actual_type, c.expected_type;
    END IF;
  END LOOP;

  CREATE TEMP TABLE IF NOT EXISTS ue0038_authority_guard (
    owner text PRIMARY KEY, fingerprint jsonb NOT NULL
  ) ON COMMIT DROP;
  DELETE FROM ue0038_authority_guard;
  INSERT INTO ue0038_authority_guard (owner, fingerprint)
  SELECT 'organization_sharing_settings', jsonb_build_object(
    'rls', t.relrowsecurity,
    'forced', t.relforcerowsecurity,
    'owner', t.relowner::regrole::text,
    'constraints', (SELECT coalesce(jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname), '[]'::jsonb)
                    FROM pg_constraint k WHERE k.conrelid = t.oid),
    'indexes', (SELECT coalesce(jsonb_agg(pg_get_indexdef(x.indexrelid) ORDER BY x.indexrelid), '[]'::jsonb)
                FROM pg_index x WHERE x.indrelid = t.oid),
    'policies', (SELECT coalesce(jsonb_agg(pg_get_expr(p.polqual, p.polrelid) ORDER BY p.polname), '[]'::jsonb)
                 FROM pg_policy p WHERE p.polrelid = t.oid),
    'grants', (SELECT coalesce(jsonb_agg(
      jsonb_build_array(g.grantee, g.privilege_type, g.is_grantable)
      ORDER BY g.grantee, g.privilege_type, g.is_grantable
    ), '[]'::jsonb) FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = t.relname)
  )
  FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'organization_sharing_settings';
END
$preflight$;
--> statement-breakpoint
ALTER TABLE public.organization_sharing_settings
  ADD COLUMN IF NOT EXISTS allow_congress_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_federation_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_province_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_sector_sharing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_sharing_levels varchar(50)[],
  ADD COLUMN IF NOT EXISTS auto_share_clauses boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_share_precedents boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_sharing_level varchar(50) DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS max_shared_clauses integer,
  ADD COLUMN IF NOT EXISTS max_shared_precedents integer,
  ADD COLUMN IF NOT EXISTS require_anonymization boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sharing_approval_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sharing_approver_role varchar(50) DEFAULT 'admin';
--> statement-breakpoint
DO $postflight$
DECLARE
  before_value jsonb;
  after_value jsonb;
BEGIN
  SELECT fingerprint INTO before_value FROM ue0038_authority_guard
    WHERE owner = 'organization_sharing_settings';
  IF before_value IS NULL THEN
    RAISE EXCEPTION '0038 fail-closed: preflight fingerprint missing';
  END IF;
  SELECT jsonb_build_object(
    'rls', t.relrowsecurity, 'forced', t.relforcerowsecurity,
    'owner', t.relowner::regrole::text,
    'constraints', (SELECT coalesce(jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname), '[]'::jsonb)
                    FROM pg_constraint k WHERE k.conrelid = t.oid),
    'indexes', (SELECT coalesce(jsonb_agg(pg_get_indexdef(x.indexrelid) ORDER BY x.indexrelid), '[]'::jsonb)
                FROM pg_index x WHERE x.indrelid = t.oid),
    'policies', (SELECT coalesce(jsonb_agg(pg_get_expr(p.polqual, p.polrelid) ORDER BY p.polname), '[]'::jsonb)
                 FROM pg_policy p WHERE p.polrelid = t.oid),
    'grants', (SELECT coalesce(jsonb_agg(
      jsonb_build_array(g.grantee, g.privilege_type, g.is_grantable)
      ORDER BY g.grantee, g.privilege_type, g.is_grantable
    ), '[]'::jsonb) FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public' AND g.table_name = t.relname)
  ) INTO after_value
  FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'organization_sharing_settings';

  IF before_value IS DISTINCT FROM after_value THEN
    RAISE EXCEPTION '0038 fail-closed: unexpected change to owner, grants, RLS, policy, index or constraint';
  END IF;
END
$postflight$;
