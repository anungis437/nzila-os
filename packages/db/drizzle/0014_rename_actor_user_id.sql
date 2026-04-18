-- Rename actor_clerk_user_id → actor_user_id in audit_events.
-- The column previously stored Clerk user IDs. After migration to platform-auth,
-- it stores platform user IDs (UUID format). The column name no longer reflects its role.
--
-- This is a backward-compatible rename: existing data is preserved as-is.
-- New inserts use the platform user ID (from auth().userId) which is correct regardless
-- of whether the session came from Entra or the PG password flow.

ALTER TABLE "audit_events"
  RENAME COLUMN "actor_clerk_user_id" TO "actor_user_id";

-- Update any existing null-ish placeholder values written by Entra sessions
-- (Entra sessions wrote the Entra object ID, which is valid — no backfill needed).
