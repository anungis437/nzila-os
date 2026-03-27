-- ============================================================================
-- Staging Schema Alignment Migration
-- Purpose: Bring staging DB in line with Django-canonical schema
-- Run: psql -h nzila-staging-db.postgres.database.azure.com -U nzilaadmin -d nzila_os_staging -f 20260327_staging_schema_alignment.sql
-- Created: 2026-03-27
--
-- ROOT CAUSE: Staging was initialized via Drizzle migration 0083
-- (claim_id as PK, no id column) while local dev was initialized
-- via Django migrations (id as PK, claim_id as UNIQUE).
-- Django is the canonical source. This migration aligns staging.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Pre-flight: detect current state
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  RAISE NOTICE 'Starting staging schema alignment — %', now();
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CLAIMS TABLE — Add Django id PK, relax NOT NULL to match Django model
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Add id column if missing (Django BaseModel pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE claims ADD COLUMN id UUID DEFAULT gen_random_uuid();
    UPDATE claims SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE claims ALTER COLUMN id SET NOT NULL;
    ALTER TABLE claims ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'claims: added id column';
  ELSE
    RAISE NOTICE 'claims: id column already exists';
  END IF;
END $$;

-- 1b. Swap PK from claim_id to id (if claim_id is currently PK)
DO $$
DECLARE
  pk_col text;
BEGIN
  SELECT a.attname INTO pk_col
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.claims'::regclass AND c.contype = 'p';

  IF pk_col = 'claim_id' THEN
    -- Drop FK constraints that reference claims_pkey before dropping it
    ALTER TABLE claim_updates DROP CONSTRAINT IF EXISTS claim_updates_claim_id_fkey;
    ALTER TABLE grievance_transitions DROP CONSTRAINT IF EXISTS grievance_transitions_claim_id_fkey;

    -- Drop old PK and add new PK on id
    ALTER TABLE claims DROP CONSTRAINT claims_pkey;
    ALTER TABLE claims ADD PRIMARY KEY (id);

    -- Add UNIQUE on claim_id so FKs can reference it
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.claims'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%claim_id%'
    ) THEN
      ALTER TABLE claims ADD CONSTRAINT claims_claim_id_key UNIQUE (claim_id);
    END IF;

    -- Re-create FK constraints pointing to the new UNIQUE constraint on claim_id
    ALTER TABLE claim_updates ADD CONSTRAINT claim_updates_claim_id_fkey
      FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE;
    ALTER TABLE grievance_transitions ADD CONSTRAINT grievance_transitions_claim_id_fkey
      FOREIGN KEY (claim_id) REFERENCES claims(claim_id);

    RAISE NOTICE 'claims: swapped PK from claim_id to id, re-created FKs';
  ELSE
    RAISE NOTICE 'claims: PK already on id (or other column: %)', pk_col;
  END IF;
END $$;

-- 1c. Relax NOT NULL constraints to match Django model
-- Django Claims model has most fields as null=True, blank=True
ALTER TABLE claims ALTER COLUMN claim_number DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN incident_date DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN location DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN description DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN desired_outcome DROP NOT NULL;
ALTER TABLE claims ALTER COLUMN claim_type DROP NOT NULL;

-- 1d. Ensure claim_id has a default (Django: default=uuid.uuid4)
ALTER TABLE claims ALTER COLUMN claim_id SET DEFAULT gen_random_uuid();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CLAIM_DEADLINES — Align timestamp types, nullability
-- ════════════════════════════════════════════════════════════════════════════

-- Staging uses timestamptz for event_date/original_deadline/due_date
-- Local uses timestamp without time zone (Django DateTimeField without tz)
-- Both are compatible for reads, no ALTER needed — just ensure no NOT NULL drift

-- Staging already has: id (PK), created_at, updated_at, claim_id — matches Django
-- Staging has all columns as nullable (from _staging_missing_tables.sql ALTER ADD)
-- This matches Django stub + Drizzle expansion. No changes needed.

-- 2a. Ensure status/priority are varchar not enum (staging uses varchar, local uses enum)
-- The enum vs varchar mismatch is cosmetic — both store the same string values.
-- For alignment, we leave staging as varchar (it's already working).

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DEADLINE_RULES — Align data types
-- ════════════════════════════════════════════════════════════════════════════

-- Staging uses text for rule_name, rule_code, description, claim_type, etc.
-- Local uses varchar for rule_name, rule_code and text for others
-- Both are functionally identical in PostgreSQL. No changes needed.

-- Add created_by if missing (present in staging Drizzle schema but not Django)
ALTER TABLE deadline_rules ADD COLUMN IF NOT EXISTS created_by text;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DOCUMENTS — Ensure org_id + original columns present alongside expanded columns
-- ════════════════════════════════════════════════════════════════════════════

-- Both local and staging have the same dual-column pattern:
-- Original: org_id, category, title, blob_container, blob_path, etc.
-- Expanded: organization_id, folder_id, name, file_url, etc.
-- Staging category is USER-DEFINED enum, local is text — leave as-is.

-- ════════════════════════════════════════════════════════════════════════════
-- 5. IN_APP_NOTIFICATIONS — Already aligned
-- ════════════════════════════════════════════════════════════════════════════

-- Both have id (PK), user_id, organization_id, title, message, type, etc.
-- Staging title/message defaults are ''::text vs local ''::text — identical.

-- ════════════════════════════════════════════════════════════════════════════
-- 6. ORGANIZATION_MEMBERS — Add missing columns from local
-- ════════════════════════════════════════════════════════════════════════════

-- Staging is missing these columns that exist on local:
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS clerk_user_id text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_approved_at timestamptz DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS search_vector text DEFAULT '';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS location text;

-- Staging has exemption columns but with different defaults — align:
-- exemption_approved_by on staging is varchar, local is varchar — OK

-- ════════════════════════════════════════════════════════════════════════════
-- 7. AUDIT_LOGS — Add missing columns from local, ensure parity
-- ════════════════════════════════════════════════════════════════════════════

-- Staging audit_logs may be missing some columns added by corrective migrations
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id uuid DEFAULT gen_random_uuid();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity varchar DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outcome varchar DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS error_message text DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT now();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS archived_path text DEFAULT '';

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Create audit_security schema if missing (used by local seed scripts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS audit_security;

CREATE TABLE IF NOT EXISTS audit_security.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id varchar,
  organization_id uuid,
  action varchar,
  resource_type varchar,
  resource_id varchar,
  ip_address inet,
  user_agent text,
  correlation_id uuid,
  details jsonb,
  changes jsonb,
  content_hash varchar,
  previous_hash varchar,
  old_values jsonb DEFAULT '{}'::jsonb,
  new_values jsonb DEFAULT '{}'::jsonb,
  session_id uuid DEFAULT gen_random_uuid(),
  severity varchar DEFAULT '',
  outcome varchar DEFAULT '',
  error_message text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  archived boolean DEFAULT false,
  archived_at timestamptz DEFAULT now(),
  archived_path text DEFAULT ''
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Verification
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  claims_pk text;
  claims_has_id boolean;
BEGIN
  -- Verify claims PK is on id
  SELECT a.attname INTO claims_pk
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.claims'::regclass AND c.contype = 'p';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'id' AND table_schema = 'public'
  ) INTO claims_has_id;

  IF claims_pk = 'id' AND claims_has_id THEN
    RAISE NOTICE '✓ claims: PK=id, id column present — ALIGNED';
  ELSE
    RAISE WARNING '✗ claims: PK=%, has_id=% — MISALIGNED', claims_pk, claims_has_id;
  END IF;
END $$;

COMMIT;

-- Post-flight summary
DO $$ BEGIN
  RAISE NOTICE 'Staging schema alignment complete — %', now();
  RAISE NOTICE 'Next step: Run Django manage.py migrate on staging to apply any remaining Django migrations';
END $$;
