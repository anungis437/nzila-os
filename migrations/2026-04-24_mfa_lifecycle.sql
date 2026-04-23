-- Nzila OS — Phase 2 auth hardening (MFA + lifecycle)
-- Adds TOTP MFA tables, per-user lifecycle state, and org-level MFA-role enforcement.
-- Idempotent: safe to re-run in dev.

BEGIN;

-- ── Users: lifecycle + provisioning-origin columns ─────────────────────────
ALTER TABLE user_management.users
  ADD COLUMN IF NOT EXISTS account_source       VARCHAR(20)  NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS lifecycle_state      VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS lifecycle_reason     TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_by VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_valid_lifecycle_state'
  ) THEN
    ALTER TABLE user_management.users
      ADD CONSTRAINT users_valid_lifecycle_state
      CHECK (lifecycle_state IN ('active','suspended','deprovisioned'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_valid_account_source'
  ) THEN
    ALTER TABLE user_management.users
      ADD CONSTRAINT users_valid_account_source
      CHECK (account_source IN ('local','sso','invite','scim'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_users_lifecycle_state ON user_management.users(lifecycle_state);

-- ── Org auth policies: MFA-role enforcement ────────────────────────────────
ALTER TABLE user_management.org_auth_policies
  ADD COLUMN IF NOT EXISTS mfa_required_for_roles JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── MFA TOTP enrollment ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_management.mfa_totp (
  user_id               VARCHAR(255) PRIMARY KEY,
  secret_encrypted      TEXT NOT NULL,
  recovery_codes_hashed JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_at            TIMESTAMPTZ,
  disabled_at           TIMESTAMPTZ,
  last_used_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── MFA challenges (short-lived post-password step-up token) ───────────────
CREATE TABLE IF NOT EXISTS user_management.mfa_challenges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            VARCHAR(255) NOT NULL,
  token_hash         TEXT NOT NULL UNIQUE,
  method             VARCHAR(20) NOT NULL DEFAULT 'totp',
  expires_at         TIMESTAMPTZ NOT NULL,
  consumed_at        TIMESTAMPTZ,
  attempts           INTEGER NOT NULL DEFAULT 0,
  ip_address         VARCHAR(45),
  user_agent         TEXT,
  pending_ip         VARCHAR(45),
  pending_user_agent TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mfa_challenge_valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT mfa_challenge_valid_method CHECK (method IN ('totp','recovery'))
);

CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user    ON user_management.mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_expires ON user_management.mfa_challenges(expires_at);

COMMIT;
