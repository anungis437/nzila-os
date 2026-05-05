-- Add missing user_management tables required by the platform-auth login flow.
-- 0102 created: users, organization_users, org_auth_policies
-- Missing: mfa_totp, user_sessions, auth_audit_log, mfa_challenges
-- Without these, POST /api/auth/login throws 500 on fresh/CI databases
-- because the login flow queries mfa_totp unconditionally and createSession
-- inserts into user_sessions (both unguarded).

-- ── TOTP MFA enrolment ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_management.mfa_totp (
  user_id          varchar(255)              PRIMARY KEY
                   REFERENCES user_management.users(user_id) ON DELETE CASCADE,
  secret_encrypted text                      NOT NULL,
  recovery_codes_hashed jsonb               DEFAULT '[]'::jsonb,
  enabled_at       timestamp with time zone,
  disabled_at      timestamp with time zone,
  last_used_at     timestamp with time zone,
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now()
);

-- ── User sessions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_management.user_sessions (
  session_id         uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            varchar(255)             NOT NULL
                     REFERENCES user_management.users(user_id) ON DELETE CASCADE,
  organization_id    uuid,
  session_token      text                     NOT NULL UNIQUE,
  refresh_token      text                     UNIQUE,
  device_info        jsonb                    DEFAULT '{}'::jsonb,
  ip_address         varchar(45),
  user_agent         text,
  expires_at         timestamp with time zone NOT NULL,
  is_active          boolean                  DEFAULT true,
  session_token_hash text,
  created_at         timestamp with time zone DEFAULT now(),
  last_used_at       timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- ── Auth audit log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_management.auth_audit_log (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    varchar(255),
  event_type varchar(50)  NOT NULL,
  ip_address varchar(45),
  user_agent text,
  metadata   jsonb        DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- ── MFA step-up challenges ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_management.mfa_challenges (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           varchar(255) NOT NULL,
  token_hash        text         NOT NULL UNIQUE,
  method            varchar(20)  NOT NULL DEFAULT 'totp',
  expires_at        timestamp with time zone NOT NULL,
  consumed_at       timestamp with time zone,
  attempts          integer      DEFAULT 0,
  ip_address        varchar(45),
  user_agent        text,
  pending_ip        varchar(45),
  pending_user_agent text,
  created_at        timestamp with time zone DEFAULT now()
);
