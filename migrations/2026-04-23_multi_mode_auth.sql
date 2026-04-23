-- Migration: 2026-04-23 — Multi-mode auth (magic-link, invites, org policies)
--
-- Adds three tables under user_management to support passwordless auth and
-- per-org policy. NOTE: existing tables (users, user_sessions,
-- password_reset_tokens, auth_audit_log) are NOT modified.

CREATE SCHEMA IF NOT EXISTS user_management;

-- ── Magic links / OTP single-use tokens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_management.magic_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 varchar(255) NOT NULL,
  user_id               varchar(255),
  organization_id       uuid,
  purpose               varchar(32) NOT NULL DEFAULT 'login',
  token_hash            text NOT NULL UNIQUE,
  expires_at            timestamptz NOT NULL,
  used_at               timestamptz,
  consumed_ip           varchar(45),
  requested_ip          varchar(45),
  requested_user_agent  text,
  attempts              integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT magic_link_valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT magic_link_valid_purpose CHECK (purpose IN ('login','invite','verify_email'))
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON user_management.magic_links (email);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON user_management.magic_links (expires_at);

-- ── Org membership invites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_management.invites (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               varchar(255) NOT NULL,
  organization_id     uuid NOT NULL,
  role                varchar(50) NOT NULL DEFAULT 'member',
  token_hash          text NOT NULL UNIQUE,
  invited_by          varchar(255) NOT NULL,
  expires_at          timestamptz NOT NULL,
  accepted_at         timestamptz,
  accepted_user_id    varchar(255),
  revoked_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT invite_valid_expiry CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_invites_email_org ON user_management.invites (email, organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_org ON user_management.invites (organization_id);

-- ── Per-org auth policy ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_management.org_auth_policies (
  organization_id         uuid PRIMARY KEY,
  allow_local_auth        boolean NOT NULL DEFAULT true,
  allow_magic_link        boolean NOT NULL DEFAULT true,
  allow_sso               boolean NOT NULL DEFAULT true,
  require_sso             boolean NOT NULL DEFAULT false,
  require_invite          boolean NOT NULL DEFAULT false,
  password_reset_allowed  boolean NOT NULL DEFAULT true,
  allowed_email_domains   jsonb DEFAULT '[]'::jsonb,
  sso_provider_id         uuid,
  updated_by              varchar(255),
  updated_at              timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);
