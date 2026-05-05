-- Migration 0100: Add missing clerk_organization_id column to organizations
-- This column is defined in Drizzle schema but was never created in CI database
-- Used for legacy Clerk integration support

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_organization_id text;

COMMIT;
