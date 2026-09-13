-- =============================================================================
-- 20260913_round58_production_geometry_prerequisites.sql
--
-- P4 Round58 Production Geometry Compatibility Remediation.
--
-- Forward-only prerequisite migration. Establishes, on 6 root tables, the
-- authority columns that db/migrations/20260910_rls_enforcement_expansion_
-- round58.sql's policy-helper calls assume exist, but which never
-- physically landed in production. Root cause (see repo memory
-- /memories/repo/pr752-storage-authority-manifest.md and this PR's
-- description): each of these 6 tables was originally created by a
-- DIFFERENT Django app's minimal `0001_initial.py` migration (id/
-- created_at/updated_at + at most one field), while this repo's Drizzle
-- schema files (db/schema/**) — and therefore the RLS-enforcement
-- generator's geometry assumptions — describe a fuller shape that a
-- competing Drizzle/raw-SQL migration lineage never actually applied to
-- these specific physical tables (dual-lineage collision: whichever
-- lineage's CREATE ran first in production silently won, and the other
-- lineage's later ALTER/CREATE-IF-NOT-EXISTS became a no-op).
--
-- This migration NEVER edits 0108 or any other historical migration file.
-- It does not touch chat_messages, board_packet_distributions, or any
-- other CHILD table — only the 6 ROOT/parent tables whose own authority
-- column was missing.
--
-- SAFETY: every ALTER below is preceded by a fail-closed emptiness
-- assertion. Per the remediation authorization, this migration must NEVER
-- invent/backfill an authority value (organization_id, congress_id,
-- sharing_level, shared_with_org_ids) for existing rows — a read-only
-- production census performed immediately before writing this migration
-- (P4 Round58 Production Geometry Compatibility Remediation, Phase A)
-- confirmed all 6 tables have ZERO rows. If a table has since gained rows
-- by the time this migration actually runs, the assertion below aborts
-- the entire migration (and, by extension, the combined single-transaction
-- apply that also includes Round58 — see apply-authority-enforcement-
-- migration.ts) rather than silently guessing an owning organization.
--
-- Idempotent: every ALTER is guarded so re-running this file (or applying
-- it to an environment where some/all of these columns already exist) is
-- a safe no-op for whichever columns are already present.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_sessions.organization_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_sessions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM chat_sessions LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: chat_sessions is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE chat_sessions ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX chat_sessions_organization_id_idx ON chat_sessions USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- board_packets.organization_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_packets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'board_packets' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM board_packets LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: board_packets is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE board_packets ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE board_packets ADD CONSTRAINT board_packets_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX board_packets_organization_id_idx ON board_packets USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- policy_rules.organization_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'policy_rules')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'policy_rules' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM policy_rules LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: policy_rules is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE policy_rules ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE policy_rules ADD CONSTRAINT policy_rules_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX policy_rules_organization_id_idx ON policy_rules USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- voting_sessions.organization_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voting_sessions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'voting_sessions' AND column_name = 'organization_id')
  THEN
    IF EXISTS (SELECT 1 FROM voting_sessions LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: voting_sessions is non-empty and has no deterministic organization_id source. Refusing to invent an owning organization.';
    END IF;
    ALTER TABLE voting_sessions ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE voting_sessions ADD CONSTRAINT voting_sessions_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX voting_sessions_organization_id_idx ON voting_sessions USING btree (organization_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- congress_memberships.congress_id
-- (organization_id is assumed already present per the manifest's TENANT_
-- RLS_REQUIRED classification for this table's own tenant column; only
-- congress_id — the SECOND authority column ue_create_parent_owned_rls_
-- policy_v2-style callers key off of — is added here. Never synthesized
-- from organization membership; a non-empty table with no deterministic
-- congress_id source aborts this migration.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'congress_memberships')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'congress_memberships' AND column_name = 'congress_id')
  THEN
    IF EXISTS (SELECT 1 FROM congress_memberships LIMIT 1) THEN
      RAISE EXCEPTION 'Round58 prerequisite aborted: congress_memberships is non-empty and has no deterministic congress_id source. Refusing to synthesize a congress ID.';
    END IF;
    ALTER TABLE congress_memberships ADD COLUMN congress_id uuid NOT NULL;
    ALTER TABLE congress_memberships ADD CONSTRAINT congress_memberships_congress_id_organizations_id_fk
      FOREIGN KEY (congress_id) REFERENCES organizations(id) ON DELETE RESTRICT;
    CREATE INDEX idx_congress_memberships_congress_id ON congress_memberships USING btree (congress_id);
    -- Unique per (organization_id, congress_id) pair, matching
    -- db/schema/congress-memberships-schema.ts's
    -- congressMembershipsOrgCongressUnique — only created here if
    -- organization_id is already present (it must be, per this table's own
    -- TENANT_RLS_REQUIRED classification); guarded defensively anyway.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'congress_memberships' AND column_name = 'organization_id')
       AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'congress_memberships' AND indexname = 'congress_memberships_org_congress_unique')
    THEN
      CREATE UNIQUE INDEX congress_memberships_org_congress_unique ON congress_memberships USING btree (organization_id, congress_id);
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- shared_clause_library.sharing_level + shared_with_org_ids
-- (source_organization_id is assumed already present per this table's own
-- MULTI_PARTY_RLS_REQUIRED / SHARED_LIBRARY_ROOT classification and
-- HIGH_CONFIDENCE_DIRECT geometry; only the two sharing-semantics columns
-- are added here.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_clause_library') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shared_clause_library' AND column_name = 'sharing_level') THEN
      IF EXISTS (SELECT 1 FROM shared_clause_library LIMIT 1) THEN
        RAISE EXCEPTION 'Round58 prerequisite aborted: shared_clause_library is non-empty and has no deterministic sharing_level source. Refusing to reinterpret existing rows as private (or any other sharing level) without an explicit, separately-approved data disposition.';
      END IF;
      -- Canonical default 'private' matches
      -- db/schema/shared-clause-library-schema.ts's sharingLevel column
      -- exactly (security-conservative: new/unclassified clauses are never
      -- shared by default). Safe here only because the table is empty.
      ALTER TABLE shared_clause_library ADD COLUMN sharing_level varchar(50) NOT NULL DEFAULT 'private';
      CREATE INDEX idx_shared_clauses_sharing ON shared_clause_library USING btree (sharing_level);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shared_clause_library' AND column_name = 'shared_with_org_ids') THEN
      IF EXISTS (SELECT 1 FROM shared_clause_library LIMIT 1) THEN
        RAISE EXCEPTION 'Round58 prerequisite aborted: shared_clause_library is non-empty and has no deterministic shared_with_org_ids source. Refusing to guess a sharing list for existing rows.';
      END IF;
      -- Nullable uuid[] matches db/schema/shared-clause-library-schema.ts's
      -- sharedWithOrgIds column exactly (no default -> NULL, meaning "not
      -- explicitly shared with anyone" until set).
      ALTER TABLE shared_clause_library ADD COLUMN shared_with_org_ids uuid[];
    END IF;
  END IF;
END $$;
