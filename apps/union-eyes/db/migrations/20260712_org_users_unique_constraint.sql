-- Add unique constraint on (user_id, organization_id) to prevent duplicate
-- org memberships in user_management.organization_users.
-- Required for upsert logic in auth seed scripts and login session resolution.

CREATE UNIQUE INDEX IF NOT EXISTS organization_users_user_id_organization_id_idx
ON user_management.organization_users (user_id, organization_id);
