-- Add missing columns to organization_members that are referenced by the API
-- position, location, hire_date, seniority, union_join_date, metadata

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS hire_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS seniority integer;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS union_join_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS metadata jsonb;
