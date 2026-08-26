-- 0038_phase_0b_organization_and_kpi_integrity.sql
--
-- Phase 0B forward migration for the Organization and Identifier
-- Integrity gate authorized by Aubert.
--
-- Companion documents:
--   * reports/audits/cupe-national-phase-0/organization-model-dependency-map.md
--   * reports/audits/cupe-national-phase-0/organization-model-decision.md
--
-- Classification: Outcome C — deliberate shared-UUID parity, governed
-- by DB constraint (FK + CHECK) and application resolver. NOT Outcome A
-- (independent mapping table permitting divergent identifiers). NOT
-- Outcome B (immediate consolidation). See the decision document for
-- the full outcome vocabulary.
--
-- What this migration does (fully idempotent, forward-only):
--
--   (1) Adds a nullable FK column `organizations.platform_tenant_id`
--       referencing `orgs(id)` ON DELETE RESTRICT.
--
--   (2) Adds CHECK constraint enforcing that when set,
--       platform_tenant_id equals organizations.id. This formalizes the
--       previously-unenforced shared-UUID convention: every
--       platform-participating organization has an `orgs` row with the
--       same UUID.
--
--   (3) Backfills platform_tenant_id for every row that already shares
--       its UUID with an existing `orgs` row.
--
--   (4) Creates the four missing platform tenant rows for the synthetic
--       Union Eyes QA orgs (1111 UE QA Primary, 2222 UE QA Secondary,
--       3333-4333 UE QA External Tester Sandbox, 4444-8444 UE Prod-like
--       Guardrail) so that platform-domain FKs from these orgs (audit
--       events, pilot metrics, AI budgets, etc.) resolve correctly.
--
--   (5) Wires platform_tenant_id for those four synthetic rows.
--
-- Design contract:
--   * Forward-only. Does not modify migrations 0000–0037.
--   * Idempotent: safe on any of empty DB, dev DB (partially populated),
--     or a DB that has already applied 0038 (second-run no-op).
--   * All ALTER, INSERT, UPDATE guarded so re-execution is a no-op.
--   * Does NOT touch KPI schema — that fix is code-only in
--     packages/ue-cognition/src/schema.ts (no DB tables exist yet).
--
-- ARCHITECTURAL PREREQUISITE — two independent schema lineages:
--   (a) Platform lineage  → packages/db/drizzle/*.sql   → creates `orgs`.
--                           Applied by
--                           tooling/scripts/apply-platform-migrations.mjs.
--                           Tracked in drizzle.__platform_migrations.
--   (b) Application lineage → apps/union-eyes/backend/*/migrations/*.py
--                           → creates `organizations` via
--                           auth_core/migrations/0001_initial.py.
--                           Applied by
--                           `python manage.py migrate` from
--                           apps/union-eyes/backend.
--                           Drizzle in apps/union-eyes/drizzle.config.ts
--                           is scoped to ./db/schema-cache/cache.ts and
--                           explicitly excludes canonical operational
--                           business entities such as organizations.
--
--   Phase 0B's same-UUID contract lives across those two lineages. This
--   migration is written so that it:
--     * runs to full effect when both lineages have been materialized
--       (dev / staging / production once Django migrate has happened);
--     * degrades to a NOT-SILENT deferred state when the application
--       lineage has not yet materialized `organizations`. The parent
--       platform runner still records `outcome_class = 'full-success'`
--       for its own binary success/partial-apply tracker, but this
--       migration ALSO writes a row into `drizzle.__phase0b_outcomes`
--       distinguishing `applied` from `deferred-app-schema-absent`.
--       Downstream verification MUST read that marker before claiming
--       organization-integrity green.
--
-- FALSE-SUCCESS PREVENTION (added in reclassification amendment):
--   Prior to the marker table, a probe DB missing `public.organizations`
--   caused this migration to RAISE NOTICE and RETURN. The parent
--   platform-migration tracker recorded the run as `full-success`,
--   indistinguishable from a real success on a fully materialized DB.
--   The marker table below removes that ambiguity by recording an
--   explicit outcome. Verification tooling MUST refuse to claim
--   integrity green when the marker for this migration filename shows
--   `deferred-app-schema-absent`.

BEGIN;

-- --------------------------------------------------------------------
-- Marker table (unconditionally created — lives in `drizzle` schema
-- alongside `__platform_migrations`). Records the substantive outcome
-- of every apply of this migration.
-- --------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__phase0b_outcomes (
  migration_filename text PRIMARY KEY,
  outcome_class      text NOT NULL,
  organizations_row_count            integer,
  orgs_row_count                     integer,
  platform_tenant_id_mapped_count    integer,
  fk_constraint_present              boolean,
  check_constraint_present           boolean,
  notes                              text,
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase0b_outcomes_class_ck
    CHECK (outcome_class IN ('applied', 'deferred-app-schema-absent'))
);

COMMENT ON TABLE drizzle.__phase0b_outcomes IS
  'Phase 0B substantive-outcome marker. One row per Phase 0B migration filename. outcome_class = "applied" only when every sub-operation ran against a materialized public.organizations. outcome_class = "deferred-app-schema-absent" when public.organizations was missing at apply time (the parent __platform_migrations record for that run is still full-success because the migration itself did not error, but the same-UUID contract is NOT in force). Downstream verification MUST read this table before claiming organization-integrity green.';

DO $mig$
DECLARE
  v_organizations_exists    boolean;
  v_organizations_rows      integer := NULL;
  v_orgs_rows               integer := NULL;
  v_mapped_rows             integer := NULL;
  v_fk_present              boolean := false;
  v_check_present           boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) INTO v_organizations_exists;

  IF NOT v_organizations_exists THEN
    RAISE NOTICE
      'Phase 0B (0038): public.organizations does not exist in this database. Recording outcome = deferred-app-schema-absent. Run the application schema init (apps/union-eyes/backend: python manage.py migrate) before this migration can take substantive effect. On next run of 0038 (after organizations is materialized) the FK, CHECK, index, backfill, and synthetic-QA provisioning will apply and the marker row will be upgraded to outcome_class = applied.';

    INSERT INTO drizzle.__phase0b_outcomes (
      migration_filename,
      outcome_class,
      organizations_row_count,
      orgs_row_count,
      platform_tenant_id_mapped_count,
      fk_constraint_present,
      check_constraint_present,
      notes
    ) VALUES (
      '0038_phase_0b_organization_and_kpi_integrity.sql',
      'deferred-app-schema-absent',
      NULL,
      (SELECT count(*)::int FROM public.orgs),
      NULL,
      false,
      false,
      'public.organizations is not present in this database. Same-UUID contract deferred until the application schema (Django migrations under apps/union-eyes/backend/) is materialized. Re-apply 0038 after Django migrate to upgrade outcome to applied.'
    )
    ON CONFLICT (migration_filename) DO UPDATE
      SET outcome_class                    = EXCLUDED.outcome_class,
          organizations_row_count          = EXCLUDED.organizations_row_count,
          orgs_row_count                   = EXCLUDED.orgs_row_count,
          platform_tenant_id_mapped_count  = EXCLUDED.platform_tenant_id_mapped_count,
          fk_constraint_present            = EXCLUDED.fk_constraint_present,
          check_constraint_present         = EXCLUDED.check_constraint_present,
          notes                            = EXCLUDED.notes,
          recorded_at                      = now();

    RETURN;
  END IF;

  -- -------------------------------------------------------------------
  -- (1) Add nullable FK column organizations.platform_tenant_id.
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    ALTER TABLE public.organizations
      ADD COLUMN IF NOT EXISTS platform_tenant_id uuid
  $sql$;

  -- -------------------------------------------------------------------
  -- (2) Add FK constraint (guarded by pg_constraint lookup).
  -- -------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_platform_tenant_id_fk'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_platform_tenant_id_fk
        FOREIGN KEY (platform_tenant_id)
        REFERENCES public.orgs(id)
        ON DELETE RESTRICT
    $sql$;
  END IF;

  -- -------------------------------------------------------------------
  -- (3) Add CHECK: platform_tenant_id, when set, MUST equal id.
  --     Same-UUID contract. Violations → SQLSTATE 23514.
  -- -------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_platform_tenant_id_equals_id'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    EXECUTE $sql$
      ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_platform_tenant_id_equals_id
        CHECK (platform_tenant_id IS NULL OR platform_tenant_id = id)
    $sql$;
  END IF;

  -- -------------------------------------------------------------------
  -- (4) Partial index (resolvePlatformTenantId lookup path).
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS organizations_platform_tenant_id_idx
      ON public.organizations (platform_tenant_id)
      WHERE platform_tenant_id IS NOT NULL
  $sql$;

  -- -------------------------------------------------------------------
  -- (5) Backfill platform_tenant_id for every already-paired row.
  --     Any organizations row whose id already exists in orgs is a
  --     confirmed platform-participant per the informal convention.
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    UPDATE public.organizations o
       SET platform_tenant_id = o.id
      WHERE o.platform_tenant_id IS NULL
        AND EXISTS (SELECT 1 FROM public.orgs og WHERE og.id = o.id)
  $sql$;

  -- -------------------------------------------------------------------
  -- (6) Provision missing orgs rows for the four synthetic Union Eyes
  --     QA organizations. Legal names come from organizations for
  --     traceability. Idempotent via ON CONFLICT DO NOTHING.
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    INSERT INTO public.orgs (id, legal_name, jurisdiction, policy_config, status)
    SELECT
      o.id,
      COALESCE(o.name, 'Synthetic QA Org ' || o.id::text) AS legal_name,
      'CA-ON' AS jurisdiction,
      '{"synthetic": true, "provenance": "phase-0b-synthetic-qa"}'::jsonb AS policy_config,
      'active'::org_status AS status
    FROM public.organizations o
    WHERE o.id IN (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444'
    )
    ON CONFLICT (id) DO NOTHING
  $sql$;

  -- -------------------------------------------------------------------
  -- (7) Wire platform_tenant_id for the four synthetic QA rows.
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    UPDATE public.organizations o
       SET platform_tenant_id = o.id
      WHERE o.id IN (
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444'
      )
      AND o.platform_tenant_id IS NULL
  $sql$;

  -- -------------------------------------------------------------------
  -- (8) Document the invariant.
  -- -------------------------------------------------------------------
  EXECUTE $sql$
    COMMENT ON COLUMN public.organizations.platform_tenant_id IS
      'Phase 0B same-UUID contract (Outcome C): nullable FK to orgs(id) whose value, when set, MUST equal organizations.id. Enforced by CHECK constraint organizations_platform_tenant_id_equals_id. NULL = pure labour-hierarchy entity (federation / district / non-participating union or local). Non-NULL = organization participates in the platform domain and has a matching orgs row. Governed provisioning via provisionPlatformParticipant().'
  $sql$;

  -- -------------------------------------------------------------------
  -- (9) Record the substantive-outcome marker as `applied` with
  --     post-state metrics.
  -- -------------------------------------------------------------------
  SELECT count(*)::int INTO v_organizations_rows FROM public.organizations;
  SELECT count(*)::int INTO v_orgs_rows          FROM public.orgs;
  SELECT count(*)::int INTO v_mapped_rows        FROM public.organizations WHERE platform_tenant_id IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_platform_tenant_id_fk'
      AND conrelid = 'public.organizations'::regclass
  ) INTO v_fk_present;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_platform_tenant_id_equals_id'
      AND conrelid = 'public.organizations'::regclass
  ) INTO v_check_present;

  INSERT INTO drizzle.__phase0b_outcomes (
    migration_filename,
    outcome_class,
    organizations_row_count,
    orgs_row_count,
    platform_tenant_id_mapped_count,
    fk_constraint_present,
    check_constraint_present,
    notes
  ) VALUES (
    '0038_phase_0b_organization_and_kpi_integrity.sql',
    'applied',
    v_organizations_rows,
    v_orgs_rows,
    v_mapped_rows,
    v_fk_present,
    v_check_present,
    'Outcome C same-UUID contract applied. FK + CHECK + partial index in place. Synthetic QA orgs provisioned. Downstream code paths crossing organizations→orgs MUST resolve via requirePlatformTenantId().'
  )
  ON CONFLICT (migration_filename) DO UPDATE
    SET outcome_class                    = EXCLUDED.outcome_class,
        organizations_row_count          = EXCLUDED.organizations_row_count,
        orgs_row_count                   = EXCLUDED.orgs_row_count,
        platform_tenant_id_mapped_count  = EXCLUDED.platform_tenant_id_mapped_count,
        fk_constraint_present            = EXCLUDED.fk_constraint_present,
        check_constraint_present         = EXCLUDED.check_constraint_present,
        notes                            = EXCLUDED.notes,
        recorded_at                      = now();
END
$mig$;

COMMIT;
