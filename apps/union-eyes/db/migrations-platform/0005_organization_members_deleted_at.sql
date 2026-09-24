-- PLATFORM_SQL 0005 — additive organization_members columns required by runtime.
-- Authority: Drizzle schema apps/union-eyes/db/schema-organizations.ts (deletedAt)
-- and historical ALIGN note in apps/union-eyes/db/migrations/0102_align_organization_members_columns.sql
-- (frozen lineage; not replayed by production bootstrap).
-- Runtime-proven gap on reconstituted staging: organization_members.deleted_at missing
-- caused getOrganizationIdForUser / withOrganizationAuth failures (Phase G blocker).
-- Idempotent ADD COLUMN IF NOT EXISTS only. No redesign.

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Companion columns still referenced by Drizzle / queries and commonly absent
-- on clean-room reconstitutions that did not replay frozen 0102.
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS hire_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS seniority integer;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS union_join_date timestamptz;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS preferred_contact_method text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS search_vector text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_approved_at timestamptz;

-- Drizzle schema apps/union-eyes/db/schema-organizations.ts also projects
-- tenant_id (legacyOrgId) and several membership/exemption columns. Absent
-- on reconstituted snapshots these cause:
--   - seed organization_members INSERT skipped (42703 tenant_id)
--   - SELECT * /users/me/organizations failures
--   - role resolution falling back to member (E2E role-nav red)
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS membership_number text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS member_category text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exempt_from_per_capita boolean;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_reason text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_approved_by varchar(255);
