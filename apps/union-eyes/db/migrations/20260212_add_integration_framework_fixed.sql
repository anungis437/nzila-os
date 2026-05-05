-- Integration Framework Database Schema
-- Migration: Add integration framework tables (FIXED)
-- Handles existing enums gracefully

BEGIN;

-- Integration types enum (with IF NOT EXISTS check)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_type') THEN
    CREATE TYPE integration_type AS ENUM (
      'hris',
      'accounting',
      'insurance',
      'pension',
      'lms',
      'communication',
      'document_management',
      'calendar',
      'social_media',
      'payment'
    );
  END IF;
END $$;

-- Integration providers enum (with IF NOT EXISTS check)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider') THEN
    CREATE TYPE integration_provider AS ENUM (
      -- HRIS
      'workday',
      'bamboohr',
      'adp',
      'ceridian_dayforce',
      'ukg_pro',
      -- Accounting
      'quickbooks',
      'xero',
      'sage_intacct',
      'freshbooks',
      'wave',
      -- Insurance
      'sunlife',
      'manulife',
      'blue_cross',
      'green_shield',
      'canada_life',
      -- Pension
      'otpp',
      'cpp_qpp',
      'provincial_pension',
      -- LMS
      'linkedin_learning',
      'udemy',
      'coursera',
      -- Communication
      'slack',
      'microsoft_teams',
      -- Document Management
      'sharepoint',
      'google_drive',
      'dropbox',
      -- Custom
      'custom'
    );
  END IF;
END $$;

-- Sync types enum (with IF NOT EXISTS check)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_type') THEN
    CREATE TYPE sync_type AS ENUM (
      'full',
      'incremental',
      'real_time'
    );
  END IF;
END $$;

-- Sync status enum (check if exists, if so skip or extend)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE sync_status AS ENUM (
      'idle',
      'synced',
      'pending',
      'running',
      'success',
      'failed',
      'partial',
      'cancelled',
      'disconnected'
    );
  ELSE
    -- Extend existing enum with new values if needed
    BEGIN
      ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'idle';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'synced';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'partial';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'cancelled';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'disconnected';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Webhook status enum (with IF NOT EXISTS check)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
    CREATE TYPE webhook_status AS ENUM (
      'received',
      'processing',
      'processed',
      'failed',
      'ignored'
    );
  END IF;
END $$;

-- Integration configurations table
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- Foreign key removed: organizations table doesn't exist yet
  type integration_type NOT NULL,
  provider integration_provider NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted, contains apiKey, clientId, tokens, etc.
  settings JSONB, -- Provider-specific settings
  webhook_url TEXT,
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_org ON integration_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_enabled ON integration_configs(enabled) WHERE enabled = true;

-- Integration sync log table
CREATE TABLE IF NOT EXISTS integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- Foreign key removed: organizations table doesn't exist yet
  provider integration_provider NOT NULL,
  sync_type sync_type NOT NULL,
  entities TEXT[], -- Array of entity types synced (e.g., ['employees', 'departments'])
  status sync_status NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  cursor TEXT, -- Pagination cursor for incremental syncs
  error TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Performance metrics
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN completed_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 
      ELSE NULL 
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_org ON integration_sync_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_provider ON integration_sync_log(provider);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_status ON integration_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_started ON integration_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_org_provider ON integration_sync_log(organization_id, provider, started_at DESC);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY, -- Hash of payload for idempotency
  organization_id UUID NOT NULL, -- Foreign key removed: organizations table doesn't exist yet
  provider integration_provider NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  verified BOOLEAN DEFAULT false,
  status webhook_status NOT NULL DEFAULT 'received',
  error TEXT,
  received_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org_provider ON webhook_events(organization_id, provider, received_at DESC);

-- Sync job schedules table (for future cron-based syncs)
CREATE TABLE IF NOT EXISTS integration_sync_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- Foreign key removed: organizations table doesn't exist yet
  provider integration_provider NOT NULL,
  sync_type sync_type NOT NULL,
  entities TEXT[],
  schedule TEXT NOT NULL, -- Cron expression
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, provider, sync_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_schedules_org ON integration_sync_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_schedules_next_run ON integration_sync_schedules(next_run_at) WHERE enabled = true;

-- Comments
COMMENT ON TABLE integration_configs IS 'Stores integration configurations and credentials per organization';
COMMENT ON TABLE integration_sync_log IS 'Logs all sync operations with performance metrics';
COMMENT ON TABLE webhook_events IS 'Stores incoming webhook events for idempotency and audit';
COMMENT ON TABLE integration_sync_schedules IS 'Defines scheduled sync jobs';

COMMIT;
