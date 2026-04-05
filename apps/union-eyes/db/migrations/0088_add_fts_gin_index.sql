-- Migration 0088: Full-text search GIN index on organization_members
-- Enables sub-millisecond text search for member lookups at scale (1M+ members)

-- 1. Add a real tsvector column alongside the existing text search_vector
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- 2. Populate the tsvector column from existing data
UPDATE organization_members
SET search_tsv = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(email, '') || ' ' ||
  coalesce(phone, '') || ' ' ||
  coalesce(membership_number, '') || ' ' ||
  coalesce(department, '') || ' ' ||
  coalesce(position, '') || ' ' ||
  coalesce(location, '')
);

-- 3. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_organization_members_search_tsv
  ON organization_members USING GIN (search_tsv);

-- 4. Create trigger to keep tsvector in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION organization_members_search_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.phone, '') || ' ' ||
    coalesce(NEW.membership_number, '') || ' ' ||
    coalesce(NEW.department, '') || ' ' ||
    coalesce(NEW.position, '') || ' ' ||
    coalesce(NEW.location, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organization_members_search ON organization_members;
CREATE TRIGGER trg_organization_members_search
  BEFORE INSERT OR UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION organization_members_search_trigger();

-- 5. Composite index for the most common query pattern: org + status
CREATE INDEX IF NOT EXISTS idx_org_members_org_status
  ON organization_members (organization_id, status);

-- 6. Index for seniority-based queries (common in union contexts)
CREATE INDEX IF NOT EXISTS idx_org_members_seniority
  ON organization_members (organization_id, seniority DESC NULLS LAST);
