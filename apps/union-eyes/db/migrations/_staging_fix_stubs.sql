-- Fix stub tables that only have (id, created_at, updated_at, organization_id)
-- Add missing columns so indexes and foreign keys can be created

-- journal_entries: add missing columns
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS period_id UUID;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by TEXT;

CREATE INDEX IF NOT EXISTS journal_entries_org_idx ON journal_entries (organization_id);
CREATE INDEX IF NOT EXISTS journal_entries_period_idx ON journal_entries (period_id);

-- journal_entry_lines: add missing columns
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS debit NUMERIC(15,2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS credit NUMERIC(15,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_account_idx ON journal_entry_lines (account_id);

-- account_mappings: add missing columns
ALTER TABLE account_mappings ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE account_mappings ADD COLUMN IF NOT EXISTS source_code TEXT;
ALTER TABLE account_mappings ADD COLUMN IF NOT EXISTS target_account_id UUID;
ALTER TABLE account_mappings ADD COLUMN IF NOT EXISTS mapping_rule TEXT;
ALTER TABLE account_mappings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS account_mappings_org_idx ON account_mappings (organization_id);

-- union_density: add year column if missing
ALTER TABLE union_density ADD COLUMN IF NOT EXISTS year INTEGER;
-- contribution_rates: add year column if missing
ALTER TABLE contribution_rates ADD COLUMN IF NOT EXISTS year INTEGER;
