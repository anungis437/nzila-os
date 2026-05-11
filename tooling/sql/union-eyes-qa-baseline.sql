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

-- Create enums for organizations table (no IF NOT EXISTS support for types, so use DO block)
DO $$ BEGIN
  CREATE TYPE organization_type AS ENUM ('platform', 'congress', 'federation', 'union', 'local', 'region', 'district');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE labour_sector AS ENUM ('healthcare', 'education', 'public_service', 'trades', 'manufacturing', 'transportation', 'retail', 'hospitality', 'technology', 'construction', 'utilities', 'telecommunications', 'financial_services', 'agriculture', 'arts_culture', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE organization_status AS ENUM ('active', 'inactive', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  display_name text,
  short_name text,
  description text,
  organization_type organization_type NOT NULL,
  parent_id uuid,
  hierarchy_path text[] NOT NULL DEFAULT ARRAY[]::text[],
  hierarchy_level integer NOT NULL DEFAULT 0,
  province_territory text,
  sectors labour_sector[] DEFAULT ARRAY[]::labour_sector[],
  email text,
  phone text,
  website text,
  address jsonb DEFAULT '{}'::jsonb,
  clc_affiliated boolean DEFAULT false,
  affiliation_date date,
  charter_number text,
  member_count integer DEFAULT 0,
  active_member_count integer DEFAULT 0,
  last_member_count_update timestamptz,
  subscription_tier text,
  billing_contact_id uuid,
  settings jsonb DEFAULT '{}'::jsonb,
  features_enabled text[] DEFAULT ARRAY[]::text[],
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  app_id uuid,
  legacy_tenant_id uuid,
  clc_affiliate_code varchar(20),
  per_capita_rate numeric(10, 2),
  remittance_day integer DEFAULT 15,
  last_remittance_date timestamptz,
  fiscal_year_end date DEFAULT '2024-12-31'
);

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
  sso_provider_id uuid,
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

-- member_category enum required by organization_members.member_category
DO $$ BEGIN
  CREATE TYPE member_category AS ENUM ('full_member', 'associate', 'honorary', 'retired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  organization_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  name text,
  email text,
  phone text,
  department text,
  membership_number text,
  position text,
  location text,
  hire_date timestamptz,
  seniority integer,
  union_join_date timestamptz,
  metadata jsonb,
  is_primary boolean,
  member_category member_category,
  exempt_from_per_capita boolean,
  exemption_reason text,
  exemption_approved_by varchar(255),
  exemption_approved_at timestamptz,
  search_vector text,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

-- Add columns idempotently for environments where the table already exists
-- with the older 14-column shape (governance-safe schema convergence).
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS membership_number text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS hire_date timestamptz;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS seniority integer;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS union_join_date timestamptz;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS member_category member_category;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS exempt_from_per_capita boolean;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS exemption_reason text;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS exemption_approved_by varchar(255);
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS exemption_approved_at timestamptz;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS search_vector text;

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  claim_number varchar(50) UNIQUE,
  organization_id uuid NOT NULL,
  member_id varchar(255),
  is_anonymous boolean DEFAULT true,
  claim_type text,
  status text NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'medium',
  incident_date timestamptz,
  location text,
  description text,
  desired_outcome text,
  witnesses_present boolean DEFAULT false,
  witness_details text,
  previously_reported boolean DEFAULT false,
  previous_report_details text,
  assigned_to varchar(255),
  assigned_at timestamptz,
  ai_score integer,
  ai_analysis jsonb,
  merit_confidence integer,
  precedent_match integer,
  complexity_score integer,
  progress integer DEFAULT 0,
  claim_amount decimal(14,2) NOT NULL DEFAULT 0,
  settlement_amount decimal(14,2) NOT NULL DEFAULT 0,
  legal_costs decimal(14,2) NOT NULL DEFAULT 0,
  court_costs decimal(14,2) NOT NULL DEFAULT 0,
  resolution_outcome varchar(100),
  filed_date timestamptz,
  resolved_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  voice_transcriptions jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  idempotency_hash varchar(64) UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz
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
