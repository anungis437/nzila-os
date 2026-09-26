--+ ============================================================================
-- Post-freeze PLATFORM_SQL SCHEMA_CREATION
-- Root: apps/union-eyes/db/migrations-platform/
-- File: 0003_integration_partners_and_security_posture.sql
-- Owner: PLATFORM_SQL_OWNED (exactly one owner each)
-- Evidence:
--   - No Django models/migrations reference these table names (rg backend/**/*.py = 0)
--   - Drizzle projections in domains/infrastructure/{integrations,audit}.ts
--   - Active readers: dashboard/integrations/page.tsx, dashboard/security/page.tsx
--   - Storage authority: TENANT_RLS_REQUIRED (not LATENT / CONTAINED)
--   - Sibling Django-owned tables (integration_configs, security_events) are different relations; not renames
-- Forward-only. Does not modify frozen lineage.
--+ ============================================================================

CREATE TABLE IF NOT EXISTS integration_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  provider varchar(100) NOT NULL,
  category varchar(100) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'connected',
  description text,
  icon varchar(500),
  config jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS integration_partners_organization_id_idx ON integration_partners (organization_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS integration_partners_provider_idx ON integration_partners (provider);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS security_posture_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  check_name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pass',
  score numeric,
  details text,
  last_checked_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS security_posture_checks_organization_id_idx ON security_posture_checks (organization_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS security_posture_checks_status_idx ON security_posture_checks (status);
