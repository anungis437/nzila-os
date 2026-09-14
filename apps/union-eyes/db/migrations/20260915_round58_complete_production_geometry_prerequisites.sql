-- =============================================================================
-- 20260915_round58_complete_production_geometry_prerequisites.sql
--
-- P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION.
--
-- Forward-only prerequisite migration, companion to
-- 20260913_round58_production_geometry_prerequisites.sql (which covered 6
-- root tables). This migration completes production geometry coverage for
-- the remaining tables discovered by a full 308-pair programmatic census
-- of 20260910_rls_enforcement_expansion_round58.sql's fail-closed gates
-- run directly against production (P4_FAILED_ROLLOUT_STATE_ASSESSMENT /
-- P4_ROUND58_COMPLETE_GEOMETRY_REMEDIATION gates). Same dual-lineage
-- collision root cause as the 0913 file: each of these tables' physical
-- production shape came from a different/earlier migration lineage than
-- the one this repo's Drizzle schema (db/schema/**) — and therefore the
-- RLS-enforcement generator's geometry assumptions — describes.
--
-- Excluded from this file (already resolved, verified against repo source
-- before writing this migration — never touch a table without a canonical
-- Drizzle schema definition backing the exact column/type/FK):
--   * congress_memberships.congress_id — already added by
--     20260913_round58_production_geometry_prerequisites.sql.
--   * automation_rules — no DDL needed; production already has
--     organization_id varchar(255) (backend/core/migrations/
--     0003_automation_rules_organization_id.py). The generator was
--     checking the wrong column name (org_id, a Drizzle-alias artifact,
--     not the physical name) — fixed via an
--     EXPLICIT_DIRECT_COLUMN_OVERRIDE in
--     scripts/rls-enforcement/enforcement-geometry-overrides.ts, not a
--     migration.
--   * settlements — has no direct organization_id column anywhere in its
--     canonical Drizzle schema (db/schema/domains/claims/grievances.ts);
--     its real authority is single-hop parent-owned via grievance_id ->
--     grievances.organization_id. Fixed via a TENANT_VIA_PARENT override
--     in enforcement-geometry-overrides.ts, not a migration (there is no
--     column to add — grievance_id already exists in production per the
--     original census, which only flagged settlements.organization_id as
--     missing).
--
-- SAFETY: every ALTER below is preceded by a fail-closed emptiness
-- assertion, matching the 0913 file's convention exactly. This migration
-- must NEVER invent/backfill an authority value for existing rows. A
-- read-only production census (P4_FAILED_ROLLOUT_STATE_ASSESSMENT)
-- confirmed all tables below have ZERO rows in production as of that
-- census. If a table has since gained rows by the time this migration
-- actually runs, the assertion aborts the entire combined-transaction
-- apply (see apply-authority-enforcement-migration.ts) rather than
-- silently guessing an owning organization.
--
-- Every column name, type, nullability, and FK/onDelete behavior below is
-- copied verbatim from this table's own canonical Drizzle schema
-- declaration (cited per block) — never invented or assumed.
--
-- Idempotent: every ALTER is guarded so re-running this file (or applying
-- it to an environment where some/all of these columns already exist) is
-- a safe no-op for whichever columns are already present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- bargaining_notes.organization_id
-- db/schema/domains/agreements/intelligence.ts: uuid NOT NULL, no FK declared.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bargaining_notes')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bargaining_notes' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM bargaining_notes LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: bargaining_notes is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE bargaining_notes ADD COLUMN organization_id uuid NOT NULL;
    CREATE INDEX bargaining_notes_organization_id_idx ON bargaining_notes USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- budget_pool.organization_id
-- db/schema/domains/infrastructure/awards.ts: varchar(255) NOT NULL, no FK.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_pool')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'budget_pool' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM budget_pool LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: budget_pool is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE budget_pool ADD COLUMN organization_id varchar(255) NOT NULL;
    CREATE INDEX idx_budget_pool_org ON budget_pool USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- calendar_events.organization_id
-- db/schema/domains/scheduling/calendar.ts: uuid NOT NULL FK organizations ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'calendar_events' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM calendar_events LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: calendar_events is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE calendar_events ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX calendar_events_organization_id_idx ON calendar_events USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- clause_comparisons.organization_id
-- db/schema/domains/agreements/clauses.ts: uuid NOT NULL, no FK declared.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clause_comparisons')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clause_comparisons' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM clause_comparisons LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: clause_comparisons is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE clause_comparisons ADD COLUMN organization_id uuid NOT NULL;
    CREATE INDEX clause_comparisons_organization_idx ON clause_comparisons USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- clc_sync_log.organization_id
-- db/schema/clc-per-capita-schema.ts: uuid NULLABLE, named FK constraint to
-- organizations (no ON DELETE clause specified -> default NO ACTION).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clc_sync_log')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clc_sync_log' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM clc_sync_log LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: clc_sync_log is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE clc_sync_log ADD COLUMN organization_id uuid;
    ALTER TABLE clc_sync_log ADD CONSTRAINT clc_sync_log_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id);
    CREATE INDEX idx_sync_log_org ON clc_sync_log USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- consent_records.organization_id
-- db/schema/domains/communications/campaigns.ts: uuid NOT NULL FK organizations ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consent_records')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'consent_records' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM consent_records LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: consent_records is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE consent_records ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE consent_records ADD CONSTRAINT consent_records_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX consent_records_organization_id_idx ON consent_records USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- cookie_consents.organization_id
-- db/schema/domains/compliance/gdpr.ts: uuid NOT NULL FK organizations ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cookie_consents')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cookie_consents' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM cookie_consents LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: cookie_consents is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE cookie_consents ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE cookie_consents ADD CONSTRAINT cookie_consents_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX cookie_consents_organization_id_idx ON cookie_consents USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- defensibility_packs.organization_id
-- db/schema/domains/infrastructure/defensibility.ts: uuid NOT NULL, no FK declared.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'defensibility_packs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'defensibility_packs' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM defensibility_packs LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: defensibility_packs is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE defensibility_packs ADD COLUMN organization_id uuid NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- geofences.union_local_id
-- db/schema/domains/compliance/geofence.ts: uuid NULLABLE, no FK by design
-- (documented tenant-boundary-under-a-domain-specific-name pattern; see
-- EXPLICIT_DIRECT_COLUMN_OVERRIDE in enforcement-geometry-overrides.ts and
-- db/rls-storage-authority/reference-latent.ts's CLOSED round-52 entry).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'geofences')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'geofences' AND column_name = 'union_local_id')
  THEN
    IF EXISTS (SELECT 1 FROM geofences LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: geofences is non-empty and has no deterministic union_local_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE geofences ADD COLUMN union_local_id uuid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- mobile_devices.organization_id
-- db/schema/mobile-devices-schema.ts: uuid NULLABLE FK organizations ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mobile_devices')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mobile_devices' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM mobile_devices LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: mobile_devices is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE mobile_devices ADD COLUMN organization_id uuid;
    ALTER TABLE mobile_devices ADD CONSTRAINT mobile_devices_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pilot_metrics.organization_id
-- db/schema/domains/marketing.ts: uuid NOT NULL FK organizations ON DELETE CASCADE.
-- Root cause of the original job-5 production failure this whole gate
-- traces back to (backend/content/models.py's PilotMetrics Django stub
-- only ever declared pilot_id).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pilot_metrics')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pilot_metrics' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM pilot_metrics LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: pilot_metrics is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE pilot_metrics ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE pilot_metrics ADD CONSTRAINT pilot_metrics_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX pilot_metrics_organization_id_idx ON pilot_metrics USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- reward_wallet_ledger.org_id
-- db/schema/domains/infrastructure/rewards.ts: uuid NOT NULL FK organizations
-- ON DELETE CASCADE. org_id IS the real physical column name (the Drizzle
-- TS field is also named orgId) — not a naming-alias defect like
-- automation_rules; no override needed, only the missing column.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reward_wallet_ledger')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reward_wallet_ledger' AND column_name = 'org_id')
  THEN
    IF EXISTS (SELECT 1 FROM reward_wallet_ledger LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: reward_wallet_ledger is non-empty and has no deterministic org_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE reward_wallet_ledger ADD COLUMN org_id uuid NOT NULL;
    ALTER TABLE reward_wallet_ledger ADD CONSTRAINT reward_wallet_ledger_org_id_organizations_id_fk
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX reward_wallet_ledger_org_user_idx ON reward_wallet_ledger USING btree (org_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- strike_fund_disbursements.organization_id
-- db/schema/domains/finance/taxes.ts: uuid NOT NULL FK organizations ON DELETE
-- CASCADE. Schema itself already carries a "Round 58 Phase 0" comment
-- anticipating this exact column.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'strike_fund_disbursements')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'strike_fund_disbursements' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM strike_fund_disbursements LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: strike_fund_disbursements is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE strike_fund_disbursements ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE strike_fund_disbursements ADD CONSTRAINT strike_fund_disbursements_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- user_consents.organization_id
-- db/schema/domains/compliance/gdpr.ts: uuid NOT NULL FK organizations ON DELETE CASCADE.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_consents')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_consents' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM user_consents LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: user_consents is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE user_consents ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE user_consents ADD CONSTRAINT user_consents_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX user_consents_organization_id_idx ON user_consents USING btree (organization_id);
  END IF;
END $$;
