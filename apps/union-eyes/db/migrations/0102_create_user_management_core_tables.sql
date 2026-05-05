-- Recreate core user_management tables required by deterministic QA/E2E seeding.
-- These tables may be absent on fresh CI databases after legacy cleanup migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS user_management;

CREATE TABLE IF NOT EXISTS user_management.users (
  user_id varchar(255) PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  email_verified boolean DEFAULT false,
  email_verified_at timestamp with time zone,
  password_hash text,
  first_name varchar(100),
  last_name varchar(100),
  display_name varchar(200),
  avatar_url text,
  phone varchar(20),
  phone_verified boolean DEFAULT false,
  phone_verified_at timestamp with time zone,
  timezone varchar(50) DEFAULT 'UTC',
  locale varchar(10) DEFAULT 'en-US',
  is_active boolean DEFAULT true,
  is_system_admin boolean DEFAULT false,
  last_login_at timestamp with time zone,
  last_login_ip varchar(45),
  password_changed_at timestamp with time zone,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamp with time zone,
  two_factor_enabled boolean DEFAULT false,
  two_factor_secret text,
  two_factor_backup_codes text[],
  account_source varchar(32) DEFAULT 'local',
  lifecycle_state varchar(32) DEFAULT 'active',
  lifecycle_reason text,
  lifecycle_changed_at timestamp with time zone,
  lifecycle_changed_by varchar(255),
  encrypted_sin text,
  encrypted_ssn text,
  encrypted_bank_account text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.organization_users (
  organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id varchar(255) NOT NULL REFERENCES user_management.users(user_id) ON DELETE CASCADE,
  role varchar(50) NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  invited_by varchar(255) REFERENCES user_management.users(user_id),
  invited_at timestamp with time zone,
  joined_at timestamp with time zone,
  last_access_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_management_org_users_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_management_organization_users_org_id
  ON user_management.organization_users (organization_id);

CREATE INDEX IF NOT EXISTS idx_user_management_organization_users_user_id
  ON user_management.organization_users (user_id);

CREATE TABLE IF NOT EXISTS user_management.org_auth_policies (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  allow_local_auth boolean DEFAULT true,
  allow_magic_link boolean DEFAULT true,
  allow_sso boolean DEFAULT true,
  require_sso boolean DEFAULT false,
  require_invite boolean DEFAULT false,
  password_reset_allowed boolean DEFAULT true,
  allowed_email_domains jsonb DEFAULT '[]'::jsonb,
  mfa_required_for_roles jsonb DEFAULT '[]'::jsonb,
  sso_provider_id uuid,
  updated_by varchar(255),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
