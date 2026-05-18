-- Re-add columns to organization_members that were dropped in 0002_true_selene
-- but are still referenced by the Drizzle schema (apps/union-eyes/db/schema-organizations.ts).
-- Without these columns the runtime SELECT * by Drizzle fails with 42703
-- ("column does not exist") on every API route that calls
-- getOrganizationIdForUser / getUserRoleFromDatabase.
-- All ADDs are idempotent.

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS hire_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS membership_number text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS seniority integer;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS union_join_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS preferred_contact_method text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS metadata text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
