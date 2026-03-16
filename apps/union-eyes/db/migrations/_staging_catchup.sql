-- Staging catch-up migration: apply missing schema changes
-- Run once to bring staging DB up to date with repo state
-- Safe: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- ============================================================
-- 1. HRIS Enum Types (from 20260212_add_hris_tables_fixed.sql)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
    CREATE TYPE employment_status AS ENUM ('active','inactive','on_leave','terminated','suspended');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_hris_provider') THEN
    CREATE TYPE external_hris_provider AS ENUM ('WORKDAY','BAMBOOHR','ADP','CERIDIAN','SAP_SF','GUSTO','PAYLOCITY','UKG','MANUAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hris_sync_status') THEN
    CREATE TYPE hris_sync_status AS ENUM ('pending','running','completed','failed','partial');
  END IF;
END $$;

-- ============================================================
-- 2. Fix external_employees (stub table exists with only 4 cols)
-- ============================================================
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS external_provider external_hris_provider;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS position_title TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS manager_external_id TEXT;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS employment_status employment_status DEFAULT 'active';
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE external_employees ADD COLUMN IF NOT EXISTS raw_data TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS external_employees_org_provider_external_id_idx 
  ON external_employees (organization_id, external_provider, external_id);
CREATE INDEX IF NOT EXISTS external_employees_org_id_idx ON external_employees (organization_id);
CREATE INDEX IF NOT EXISTS external_employees_provider_idx ON external_employees (external_provider);
CREATE INDEX IF NOT EXISTS external_employees_email_idx ON external_employees (email);
CREATE INDEX IF NOT EXISTS external_employees_status_idx ON external_employees (employment_status);
CREATE INDEX IF NOT EXISTS external_employees_synced_at_idx ON external_employees (last_synced_at);

-- ============================================================
-- 3. HRIS Positions table
-- ============================================================
CREATE TABLE IF NOT EXISTS external_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  external_provider external_hris_provider NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  grade TEXT,
  pay_band TEXT,
  is_management BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  raw_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_positions_org_provider_external_id_idx
  ON external_positions (organization_id, external_provider, external_id);
CREATE INDEX IF NOT EXISTS external_positions_org_id_idx ON external_positions (organization_id);

-- ============================================================
-- 4. HRIS Departments table
-- ============================================================
CREATE TABLE IF NOT EXISTS external_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  external_provider external_hris_provider NOT NULL,
  name TEXT NOT NULL,
  parent_department_id TEXT,
  head_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  raw_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_departments_org_provider_external_id_idx
  ON external_departments (organization_id, external_provider, external_id);
CREATE INDEX IF NOT EXISTS external_departments_org_id_idx ON external_departments (organization_id);

-- ============================================================
-- 5. HRIS Sync Log table
-- ============================================================
CREATE TABLE IF NOT EXISTS hris_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider external_hris_provider NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status hris_sync_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_errored INTEGER DEFAULT 0,
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hris_sync_log_org_id_idx ON hris_sync_log (organization_id);
CREATE INDEX IF NOT EXISTS hris_sync_log_status_idx ON hris_sync_log (status);

-- ============================================================
-- 6. Integration Framework (from 20260212_add_integration_framework_fixed.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider TEXT NOT NULL,
  connection_type TEXT NOT NULL DEFAULT 'api',
  status TEXT NOT NULL DEFAULT 'inactive',
  config JSONB DEFAULT '{}'::jsonb,
  credentials_vault_key TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  sync_interval_minutes INTEGER DEFAULT 60,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_connections_org_idx ON integration_connections (organization_id);
CREATE INDEX IF NOT EXISTS integration_connections_provider_idx ON integration_connections (provider);
CREATE INDEX IF NOT EXISTS integration_connections_status_idx ON integration_connections (status);

CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transform_rule TEXT,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_field_mappings_conn_idx ON integration_field_mappings (connection_id);

CREATE TABLE IF NOT EXISTS integration_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_errored INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_sync_history_conn_idx ON integration_sync_history (connection_id);
CREATE INDEX IF NOT EXISTS integration_sync_history_status_idx ON integration_sync_history (status);

-- ============================================================
-- 7. Accounting tables (from 20260213_add_accounting_tables_fixed.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounting_periods_org_idx ON accounting_periods (organization_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  period_id UUID REFERENCES accounting_periods(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'draft',
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_entries_org_idx ON journal_entries (organization_id);
CREATE INDEX IF NOT EXISTS journal_entries_period_idx ON journal_entries (period_id);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID,
  description TEXT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_account_idx ON journal_entry_lines (account_id);

CREATE TABLE IF NOT EXISTS account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  source_code TEXT NOT NULL,
  target_account_id UUID,
  mapping_rule TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_mappings_org_idx ON account_mappings (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_mappings_org_source_idx ON account_mappings (organization_id, source_system, source_code);

-- ============================================================
-- 8. Fix data source table columns (from 0083_data_source_tables.sql failures)
-- ============================================================
ALTER TABLE external_data_sync_log ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE external_data_sync_log ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
