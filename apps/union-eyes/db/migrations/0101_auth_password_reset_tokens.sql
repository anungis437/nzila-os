-- Migration: 20260711_auth_password_reset_tokens
-- Description: Add password_reset_tokens table and session_token_hash column
--              for PostgreSQL-backed email/password authentication.
-- Author: nzila-automation
-- Date: 2026-07-11

BEGIN;

-- ============================================================================
-- 1. Password Reset Tokens table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_management.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL
    REFERENCES user_management.users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Token must expire after creation
  CONSTRAINT valid_token_expiry CHECK (expires_at > created_at)
);

-- Indexes for password reset token lookups
CREATE INDEX IF NOT EXISTS idx_prt_token_hash
  ON user_management.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id
  ON user_management.password_reset_tokens(user_id);
-- Cleanup index: find expired/used tokens for periodic purge
CREATE INDEX IF NOT EXISTS idx_prt_expires_at
  ON user_management.password_reset_tokens(expires_at)
  WHERE used_at IS NULL;

-- ============================================================================
-- 2. Add session_token_hash to user_sessions for secure session storage
--    Existing session_token column remains for backward compatibility.
--    New sessions will populate session_token_hash with SHA-256 of the opaque token.
-- ============================================================================
ALTER TABLE user_management.user_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_management.user_sessions(session_token_hash)
  WHERE session_token_hash IS NOT NULL;

-- ============================================================================
-- 3. Audit log table for auth events
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_management.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES user_management.users(user_id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user
  ON user_management.auth_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event
  ON user_management.auth_audit_log(event_type, created_at DESC);
-- Rate-limit queries: count events by IP in time window
CREATE INDEX IF NOT EXISTS idx_auth_audit_ip_time
  ON user_management.auth_audit_log(ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

COMMIT;
