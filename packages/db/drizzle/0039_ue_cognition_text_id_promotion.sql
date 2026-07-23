-- ============================================================================
-- Drizzle migration 0039 — UE Cognition schema relocation + text-ID promotion
--
-- Phase 0B.2 §12 — Bundles two invariants for the six UE-owned Cognition
-- telemetry tables:
--
--   1. Target schema is `union_eyes` (not `public`), matching
--      packages/db/schema-ownership-manifest.json ownership records:
--        ue_case_risk_snapshots  UNION_EYES_OWNED_EXCLUSIVE
--        ue_cognition_audits     UNION_EYES_OWNED_EXCLUSIVE
--        ue_engagement_snapshots UNION_EYES_OWNED_EXCLUSIVE
--        ue_kpi_snapshots        UNION_EYES_OWNED_EXCLUSIVE
--        ue_precedent_matches    UNION_EYES_OWNED_EXCLUSIVE
--        ue_workload_snapshots   UNION_EYES_OWNED_EXCLUSIVE
--
--   2. `id` column is `text` (not `uuid`) because the runtime writes prefixed
--      identifiers via `makeId('crs' | 'wls' | 'mes' | 'pcm' | 'kpi' | 'aud')`
--      in packages/ue-cognition/src/utils.ts. The current Drizzle declaration
--      (packages/ue-cognition/src/schema.ts) declares `uuid` — this migration
--      is the corrective single source of truth.
--
-- Handles three starting states idempotently:
--   A. Fresh install (neither schema has the tables): CREATE in union_eyes.
--   B. Legacy install with tables in `public`: ALTER … SET SCHEMA union_eyes,
--      then ALTER COLUMN id TYPE text if still uuid.
--   C. Already-migrated install: no-ops via IF NOT EXISTS / information_schema
--      guards.
--
-- The migration is wrapped in a single BEGIN/COMMIT block so all six tables
-- move atomically; if any step fails, no schema drift is left behind.
-- ============================================================================

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Ensure union_eyes schema exists.
-- ───────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS union_eyes;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Relocate any legacy public.ue_* tables into union_eyes.
--    Uses a PL/pgSQL block so we can iterate the six table names and check
--    for existence before issuing ALTER TABLE … SET SCHEMA.
-- ───────────────────────────────────────────────────────────────────────────
DO $phase0b2_ue_cognition_relocate$
DECLARE
  t text;
  legacy_names text[] := ARRAY[
    'ue_case_risk_snapshots',
    'ue_workload_snapshots',
    'ue_engagement_snapshots',
    'ue_precedent_matches',
    'ue_kpi_snapshots',
    'ue_cognition_audits'
  ];
BEGIN
  FOREACH t IN ARRAY legacy_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'union_eyes'
          AND table_name = t
      ) THEN
        RAISE EXCEPTION
          'Phase 0B.2 §12 relocation aborted: both public.% and union_eyes.% exist. '
          'Manual resolution required — the two rows sets must be reconciled '
          'before this migration can proceed.', t, t;
      END IF;

      EXECUTE format('ALTER TABLE public.%I SET SCHEMA union_eyes', t);
    END IF;
  END LOOP;
END
$phase0b2_ue_cognition_relocate$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3) Create the six tables in union_eyes if they do not yet exist.
--    Columns mirror packages/ue-cognition/src/schema.ts EXCEPT that
--    `id` is `text PRIMARY KEY` (Phase 0B.2 §12 promotion) and `org_id`
--    remains `uuid` (Option D tenant contract).
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS union_eyes.ue_case_risk_snapshots (
  id                    text                        PRIMARY KEY,
  tenant_id             text                        NOT NULL,
  org_id                uuid                        NOT NULL,
  case_id               text                        NOT NULL,
  case_kind             text                        NOT NULL,
  risk_score            integer                     NOT NULL,
  risk_probability      double precision            NOT NULL,
  risk_tier             text                        NOT NULL,
  confidence            double precision            NOT NULL,
  recommended_action    text                        NOT NULL,
  rationale             text                        NOT NULL,
  top_factors           jsonb                       NOT NULL,
  factors               jsonb                       NOT NULL,
  trajectory            jsonb                       NOT NULL,
  model_version         text                        NOT NULL,
  snapshot_at           timestamp with time zone    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_eyes.ue_workload_snapshots (
  id                             text                        PRIMARY KEY,
  tenant_id                      text                        NOT NULL,
  org_id                         uuid                        NOT NULL,
  steward_id                     text                        NOT NULL,
  current_caseload               integer                     NOT NULL,
  max_caseload                   integer                     NOT NULL,
  utilization_ratio              double precision            NOT NULL,
  at_risk_case_count             integer                     NOT NULL,
  avg_response_days              double precision,
  status                         text                        NOT NULL,
  sla_risk_score                 double precision            NOT NULL,
  burnout_signal                 double precision            NOT NULL,
  recommended_reassignments      jsonb                       NOT NULL,
  snapshot_at                    timestamp with time zone    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_eyes.ue_engagement_snapshots (
  id                          text                        PRIMARY KEY,
  tenant_id                   text                        NOT NULL,
  org_id                      uuid                        NOT NULL,
  member_id                   text                        NOT NULL,
  engagement_score            integer                     NOT NULL,
  disengagement_probability   double precision            NOT NULL,
  tier                        text                        NOT NULL,
  days_since_last_activity    double precision            NOT NULL,
  recent_signals              jsonb                       NOT NULL,
  recommended_channel         text                        NOT NULL,
  recommended_timing_hours    double precision            NOT NULL,
  model_version               text                        NOT NULL,
  snapshot_at                 timestamp with time zone    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_eyes.ue_precedent_matches (
  id                          text                        PRIMARY KEY,
  tenant_id                   text                        NOT NULL,
  org_id                      uuid                        NOT NULL,
  for_case_id                 text                        NOT NULL,
  matches                     jsonb                       NOT NULL,
  typical_days_to_resolve     double precision,
  typical_settlement_amount   double precision,
  success_rate                double precision            NOT NULL,
  retrieved_at                timestamp with time zone    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_eyes.ue_kpi_snapshots (
  id              text                        PRIMARY KEY,
  tenant_id       text                        NOT NULL,
  org_id          uuid                        NOT NULL,
  window_days     integer                     NOT NULL,
  window_start    timestamp with time zone    NOT NULL,
  window_end      timestamp with time zone    NOT NULL,
  payload         jsonb                       NOT NULL,
  model_version   text                        NOT NULL,
  computed_at     timestamp with time zone    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_eyes.ue_cognition_audits (
  id            text                        PRIMARY KEY,
  tenant_id     text                        NOT NULL,
  org_id        uuid                        NOT NULL,
  resource      text                        NOT NULL,
  action        text                        NOT NULL,
  actor_id      text,
  resource_id   text                        NOT NULL,
  details       jsonb                       NOT NULL,
  occurred_at   timestamp with time zone    NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4) Promote id from uuid → text for tables that were relocated from public
--    in step 2. Uses information_schema to detect legacy `uuid` id columns
--    and rewrites them in place.
-- ───────────────────────────────────────────────────────────────────────────
DO $phase0b2_ue_cognition_id_promote$
DECLARE
  t text;
  ue_names text[] := ARRAY[
    'ue_case_risk_snapshots',
    'ue_workload_snapshots',
    'ue_engagement_snapshots',
    'ue_precedent_matches',
    'ue_kpi_snapshots',
    'ue_cognition_audits'
  ];
  current_type text;
BEGIN
  FOREACH t IN ARRAY ue_names LOOP
    SELECT data_type
      INTO current_type
      FROM information_schema.columns
      WHERE table_schema = 'union_eyes'
        AND table_name = t
        AND column_name = 'id';

    IF current_type IS NULL THEN
      -- Table itself missing — should not happen after step 3, but stay safe.
      CONTINUE;
    END IF;

    IF current_type = 'uuid' THEN
      -- Drop any uuid-side default that references gen_random_uuid() before
      -- retyping. `ALTER COLUMN … TYPE text USING id::text` preserves values.
      EXECUTE format(
        'ALTER TABLE union_eyes.%I ALTER COLUMN id DROP DEFAULT',
        t
      );
      EXECUTE format(
        'ALTER TABLE union_eyes.%I ALTER COLUMN id TYPE text USING id::text',
        t
      );
    ELSIF current_type <> 'text' THEN
      RAISE EXCEPTION
        'Phase 0B.2 §12 id-promotion aborted: union_eyes.%.id has unexpected '
        'type %s (expected uuid or text).', t, current_type;
    END IF;
  END LOOP;
END
$phase0b2_ue_cognition_id_promote$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5) Verification: assert every foundational UE Cognition table lives in
--    union_eyes and has id of type text.
-- ───────────────────────────────────────────────────────────────────────────
DO $phase0b2_ue_cognition_verify$
DECLARE
  t text;
  ue_names text[] := ARRAY[
    'ue_case_risk_snapshots',
    'ue_workload_snapshots',
    'ue_engagement_snapshots',
    'ue_precedent_matches',
    'ue_kpi_snapshots',
    'ue_cognition_audits'
  ];
  found_schema text;
  found_type text;
BEGIN
  FOREACH t IN ARRAY ue_names LOOP
    SELECT table_schema
      INTO found_schema
      FROM information_schema.tables
      WHERE table_name = t
        AND table_schema IN ('public', 'union_eyes');

    IF found_schema IS NULL THEN
      RAISE EXCEPTION
        'Phase 0B.2 §12 verification failed: table % missing from both '
        'public and union_eyes schemas.', t;
    END IF;

    IF found_schema <> 'union_eyes' THEN
      RAISE EXCEPTION
        'Phase 0B.2 §12 verification failed: table % lives in schema %s '
        '(expected union_eyes).', t, found_schema;
    END IF;

    SELECT data_type
      INTO found_type
      FROM information_schema.columns
      WHERE table_schema = 'union_eyes'
        AND table_name = t
        AND column_name = 'id';

    IF found_type <> 'text' THEN
      RAISE EXCEPTION
        'Phase 0B.2 §12 verification failed: union_eyes.%.id has type %s '
        '(expected text).', t, found_type;
    END IF;
  END LOOP;
END
$phase0b2_ue_cognition_verify$;

COMMIT;
