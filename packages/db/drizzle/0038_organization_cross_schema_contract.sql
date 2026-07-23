-- 0038_organization_cross_schema_contract.sql
--
-- Phase 0B.2 §10 — Governed hybrid (Option D) cross-schema organization
-- contract between the platform side (``public.orgs``) and the Union-Eyes
-- side (``union_eyes.organizations``).
--
-- Invariants enforced:
--
--   1. ``union_eyes.organizations.platform_tenant_id`` exists and is NOT NULL.
--   2. ``union_eyes.organizations.platform_tenant_id`` is a FOREIGN KEY to
--      ``public.orgs(id)``.
--   3. ``union_eyes.organizations.platform_tenant_id = union_eyes.organizations.id``
--      (CHECK constraint — the UE tenant UUID *is* the platform tenant UUID).
--   4. A UNIQUE index on ``union_eyes.organizations.platform_tenant_id``
--      permits reverse lookup by platform tenant id in O(log n).
--
-- Preconditions:
--
--   * Django migration ``auth_core/0003_move_organizations_to_union_eyes``
--     has run, so ``union_eyes.organizations`` exists.
--   * ``public.orgs`` exists (created by an earlier platform migration).
--
-- Second-run behaviour: idempotent. All DDL is guarded by information_schema
-- lookups and ``IF NOT EXISTS`` clauses.
--
-- This migration supersedes any prior draft of 0038 that may exist on
-- feature branches. On the ``fix/union-eyes-phase0b-clean`` branch this is
-- the canonical Section 10 artefact.

BEGIN;

-- ─── 1) Ensure the target schema and table are present ────────────────────
DO $phase0b2_precondition$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'union_eyes'
    ) THEN
        RAISE EXCEPTION
            '0038 precondition failed: schema union_eyes not present. '
            'Run Django migration auth_core/0003 first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'union_eyes' AND table_name = 'organizations'
    ) THEN
        RAISE EXCEPTION
            '0038 precondition failed: union_eyes.organizations not present. '
            'Run Django migration auth_core/0003 first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orgs'
    ) THEN
        RAISE EXCEPTION
            '0038 precondition failed: public.orgs not present.';
    END IF;
END
$phase0b2_precondition$;

-- ─── 2) Add ``platform_tenant_id`` column (nullable, so we can backfill) ──
ALTER TABLE union_eyes.organizations
    ADD COLUMN IF NOT EXISTS platform_tenant_id uuid;

-- ─── 3) Backfill: platform_tenant_id := id (the CHECK invariant) ─────────
UPDATE union_eyes.organizations
   SET platform_tenant_id = id
 WHERE platform_tenant_id IS NULL;

-- ─── 4) Seed matching rows into public.orgs for any UE org that has no
--       platform counterpart yet. Uses a minimal, safe row shape.
INSERT INTO public.orgs (id, legal_name, jurisdiction, status)
SELECT
    ue.id,
    COALESCE(ue.name, 'Union-Eyes organization ' || ue.id::text) AS legal_name,
    'CA' AS jurisdiction,
    'active'::org_status AS status
  FROM union_eyes.organizations AS ue
 WHERE NOT EXISTS (
     SELECT 1 FROM public.orgs AS p WHERE p.id = ue.id
 );

-- ─── 5) Enforce NOT NULL now that every row has a value ──────────────────
DO $phase0b2_notnull$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'union_eyes'
           AND table_name = 'organizations'
           AND column_name = 'platform_tenant_id'
           AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE union_eyes.organizations
            ALTER COLUMN platform_tenant_id SET NOT NULL;
    END IF;
END
$phase0b2_notnull$;

-- ─── 6) Cross-schema FK: union_eyes.organizations.platform_tenant_id →
--       public.orgs(id). Deferrable so a single transaction can insert into
--       both sides.
DO $phase0b2_fk$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'organizations_platform_tenant_id_fkey'
           AND conrelid = 'union_eyes.organizations'::regclass
    ) THEN
        ALTER TABLE union_eyes.organizations
            ADD CONSTRAINT organizations_platform_tenant_id_fkey
                FOREIGN KEY (platform_tenant_id)
                REFERENCES public.orgs (id)
                DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
END
$phase0b2_fk$;

-- ─── 7) CHECK constraint: platform_tenant_id = id ─────────────────────────
DO $phase0b2_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'organizations_platform_tenant_id_equals_id_check'
           AND conrelid = 'union_eyes.organizations'::regclass
    ) THEN
        ALTER TABLE union_eyes.organizations
            ADD CONSTRAINT organizations_platform_tenant_id_equals_id_check
                CHECK (platform_tenant_id = id);
    END IF;
END
$phase0b2_check$;

-- ─── 8) Unique index for O(log n) reverse lookup ─────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_organizations_platform_tenant_id
    ON union_eyes.organizations (platform_tenant_id);

-- ─── 9) Verification: every UE org has a platform counterpart ────────────
DO $phase0b2_verify$
DECLARE
    v_missing BIGINT;
    v_check_violations BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_missing
      FROM union_eyes.organizations ue
      LEFT JOIN public.orgs p ON p.id = ue.platform_tenant_id
     WHERE p.id IS NULL;

    IF v_missing > 0 THEN
        RAISE EXCEPTION
            '0038 verification failed: % UE organization(s) have no '
            'matching public.orgs row.', v_missing;
    END IF;

    SELECT COUNT(*) INTO v_check_violations
      FROM union_eyes.organizations
     WHERE platform_tenant_id <> id;

    IF v_check_violations > 0 THEN
        RAISE EXCEPTION
            '0038 verification failed: % row(s) violate '
            'platform_tenant_id = id invariant.', v_check_violations;
    END IF;
END
$phase0b2_verify$;

COMMIT;
