-- Union Eyes QA/CI baseline bootstrap
--
-- Purpose: materialize the minimum canonical tables required by
-- db:migrate + seed:test-env on a fresh Postgres instance when no
-- snapshot URL is configured and scoped migrations are empty.
--
-- This is intentionally narrow and idempotent. It is only used by
-- tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs in QA/CI mode.

CREATE SCHEMA IF NOT EXISTS user_management;
CREATE SCHEMA IF NOT EXISTS audit_security;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization_type text NOT NULL,
  hierarchy_path text[] NOT NULL DEFAULT ARRAY[]::text[],
  hierarchy_level integer NOT NULL DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.users (
  user_id varchar(255) PRIMARY KEY,
  email varchar(255) UNIQUE,
  email_verified boolean DEFAULT false,
  email_verified_at timestamptz,
  password_hash text,
  first_name varchar(100),
  last_name varchar(100),
  display_name varchar(200),
  is_active boolean DEFAULT true,
  is_system_admin boolean DEFAULT false,
  account_source varchar(20) NOT NULL DEFAULT 'local',
  lifecycle_state varchar(20) NOT NULL DEFAULT 'active',
  password_changed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.organization_users (
  organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_users_user_id_organization_id_idx
  ON user_management.organization_users (user_id, organization_id);

CREATE TABLE IF NOT EXISTS user_management.user_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL,
  organization_id uuid,
  session_token text NOT NULL UNIQUE,
  refresh_token text,
  ip_address varchar(45),
  user_agent text,
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  session_token_hash text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_management.org_auth_policies (
  organization_id uuid PRIMARY KEY,
  allow_local_auth boolean NOT NULL DEFAULT true,
  allow_magic_link boolean NOT NULL DEFAULT true,
  allow_sso boolean NOT NULL DEFAULT true,
  require_sso boolean NOT NULL DEFAULT false,
  require_invite boolean NOT NULL DEFAULT false,
  password_reset_allowed boolean NOT NULL DEFAULT true,
  allowed_email_domains jsonb DEFAULT '[]'::jsonb,
  mfa_required_for_roles jsonb DEFAULT '[]'::jsonb,
  updated_by varchar(255),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
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

CREATE TABLE IF NOT EXISTS user_management.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  organization_id uuid NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'member',
  token_hash text NOT NULL UNIQUE,
  invited_by varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_user_id varchar(255),
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  name text,
  email text,
  metadata jsonb,
  is_primary boolean,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE,
  claim_number varchar(50),
  organization_id uuid,
  member_id varchar(255),
  claim_type text,
  status text NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'medium',
  incident_date timestamptz,
  location text,
  description text,
  desired_outcome text,
  filed_date timestamptz,
  assigned_to varchar(255),
  assigned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.claim_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid UNIQUE DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL,
  update_type varchar(50),
  message text,
  created_by varchar(255),
  is_internal boolean DEFAULT false,
  visibility_scope text NOT NULL DEFAULT 'member',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_security.audit_logs (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id varchar(255),
  action varchar(100) NOT NULL,
  resource_type varchar(50) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_security.security_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id varchar(255),
  event_type varchar(50) NOT NULL,
  event_category varchar(30) NOT NULL,
  severity varchar(20) NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);
