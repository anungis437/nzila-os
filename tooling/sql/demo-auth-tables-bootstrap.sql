-- Demo DB bootstrap: minimum user_management tables for platform-auth login
CREATE SCHEMA IF NOT EXISTS user_management;

CREATE TABLE IF NOT EXISTS user_management.users (
  user_id varchar(255) PRIMARY KEY NOT NULL,
  email varchar(255) NOT NULL,
  email_verified boolean DEFAULT false,
  email_verified_at timestamptz,
  password_hash text,
  first_name varchar(100),
  last_name varchar(100),
  display_name varchar(200),
  avatar_url text,
  phone varchar(20),
  phone_verified boolean DEFAULT false,
  phone_verified_at timestamptz,
  timezone varchar(50) DEFAULT 'UTC',
  locale varchar(10) DEFAULT 'en-US',
  is_active boolean DEFAULT true,
  is_system_admin boolean DEFAULT false,
  last_login_at timestamptz,
  last_login_ip varchar(45),
  password_changed_at timestamptz,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamptz,
  two_factor_enabled boolean DEFAULT false,
  two_factor_secret text,
  two_factor_backup_codes text[],
  encrypted_sin text,
  encrypted_ssn text,
  encrypted_bank_account text,
  account_source varchar(20) NOT NULL DEFAULT 'local',
  lifecycle_state varchar(20) NOT NULL DEFAULT 'active',
  lifecycle_reason text,
  lifecycle_changed_at timestamptz,
  lifecycle_changed_by varchar(255),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS user_management.user_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  organization_id uuid,
  session_token text NOT NULL UNIQUE,
  refresh_token text,
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address varchar(45),
  user_agent text,
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  session_token_hash text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255),
  event_type varchar(50) NOT NULL,
  ip_address varchar(45),
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  user_id varchar(255),
  organization_id uuid,
  purpose varchar(32) NOT NULL DEFAULT 'login',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.organization_users (
  organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  invited_by varchar(255),
  invited_at timestamptz,
  joined_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_users_user_id_organization_id_idx
  ON user_management.organization_users (user_id, organization_id);

-- MFA tables (login flow checks TOTP enrollment status on every sign-in)
CREATE TABLE IF NOT EXISTS user_management.mfa_totp (
  user_id varchar(255) PRIMARY KEY,
  secret_encrypted text NOT NULL,
  recovery_codes_hashed jsonb DEFAULT '[]'::jsonb,
  enabled_at timestamptz,
  disabled_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  token_hash text NOT NULL UNIQUE,
  method varchar(20) NOT NULL DEFAULT 'totp',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer DEFAULT 0,
  ip_address varchar(45),
  user_agent text,
  pending_ip varchar(45),
  pending_user_agent text,
  created_at timestamptz DEFAULT now()
);
