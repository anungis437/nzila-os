-- =============================================================================
-- Migration: Clerk → Entra External ID — User Identity Column Updates
-- Date: 2026-07-10
-- Description:
--   1. Renames org_members.clerk_user_id → user_id (lookup column for auth)
--   2. Renames partner_users.clerk_user_id → user_id
--   3. Adds entra_oid column to user_uuid_mapping for ID mapping
--   4. Adds user_id_type column for dual-ID transition awareness
--
-- NOTE: audit_events.actor_clerk_user_id is NOT renamed — immutable audit trail.
-- Historical records keep Clerk IDs; new records will store Entra Object IDs.
-- =============================================================================

BEGIN;

-- ── 1. Rename org_members.clerk_user_id → user_id ───────────────────────────
ALTER TABLE org_members
  RENAME COLUMN clerk_user_id TO user_id;

COMMENT ON COLUMN org_members.user_id IS
  'Auth provider user ID. Was Clerk user_xxx, now Entra Object ID (UUID).';

-- ── 2. Rename partner_users.clerk_user_id → user_id ─────────────────────────
ALTER TABLE partner_users
  RENAME COLUMN clerk_user_id TO user_id;

COMMENT ON COLUMN partner_users.user_id IS
  'Auth provider user ID. Was Clerk user_xxx, now Entra Object ID (UUID).';

-- ── 3. Add entra_oid to user_uuid_mapping ───────────────────────────────────
ALTER TABLE user_uuid_mapping
  ADD COLUMN IF NOT EXISTS entra_oid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_uuid_mapping_entra_oid
  ON user_uuid_mapping (entra_oid)
  WHERE entra_oid IS NOT NULL;

COMMENT ON COLUMN user_uuid_mapping.entra_oid IS
  'Microsoft Entra External ID Object ID. Set during Clerk→Entra user migration.';

-- ── 4. Add comment on audit_events.actor_clerk_user_id ──────────────────────
COMMENT ON COLUMN audit_events.actor_clerk_user_id IS
  'User ID of the actor. Historical values are Clerk IDs (user_xxx). '
  'New entries post-migration store Entra Object IDs. Column name retained for immutability.';

COMMIT;
