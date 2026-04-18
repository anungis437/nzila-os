-- ============================================================================
-- ZONGA PLAN MODEL UNIFICATION
-- Migrate zonga_creator_plan enum from (artist, label, enterprise)
-- to canonical model (starter, pro, business, label, enterprise)
-- ============================================================================
-- Run with: psql -U nzila -d nzila_automation -p 5433 -h localhost -f <this file>
-- ============================================================================

BEGIN;

-- 1. Add new enum values (PG requires ADD VALUE outside transaction in older versions,
--    but PG 12+ supports it in transactions with certain conditions)
ALTER TYPE zonga_creator_plan ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE zonga_creator_plan ADD VALUE IF NOT EXISTS 'pro';
ALTER TYPE zonga_creator_plan ADD VALUE IF NOT EXISTS 'business';

-- 2. Migrate existing 'artist' rows → 'starter' (artist was the free/default tier)
UPDATE zonga_creators SET plan = 'starter' WHERE plan = 'artist';

-- 3. Update the column default
ALTER TABLE zonga_creators ALTER COLUMN plan SET DEFAULT 'starter';

-- 4. Note: 'artist' value remains in the enum for backward compat with existing DB
--    rows that were not updated. It is effectively deprecated.
--    Optionally: Remove it by creating a new type (requires full table rewrite):
-- CREATE TYPE zonga_creator_plan_new AS ENUM ('starter','pro','business','label','enterprise');
-- ALTER TABLE zonga_creators ALTER COLUMN plan TYPE zonga_creator_plan_new USING plan::text::zonga_creator_plan_new;
-- DROP TYPE zonga_creator_plan;
-- ALTER TYPE zonga_creator_plan_new RENAME TO zonga_creator_plan;

COMMIT;
