DO $$
BEGIN
  IF current_database() <> 'nzila_platform_authz_acceptance' THEN
    RAISE EXCEPTION 'Refusing authz acceptance bootstrap in unexpected database: %', current_database();
  END IF;
END
$$;

CREATE TYPE org_status AS ENUM ('active', 'inactive');

CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id varchar(255) UNIQUE,
  legal_name text NOT NULL,
  jurisdiction varchar(10) NOT NULL,
  incorporation_number text,
  registered_office_address jsonb,
  fiscal_year_end varchar(5),
  policy_config jsonb DEFAULT '{}',
  status org_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA user_management;

CREATE TABLE user_management.users (
  user_id varchar(255) PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  email_verified boolean DEFAULT false,
  email_verified_at timestamptz,
  password_hash text,
  first_name varchar(100),
  last_name varchar(100),
  display_name varchar(200),
  avatar_url text,
  phone varchar(20),
  phone_verified boolean DEFAULT false,
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
  account_source varchar(20) NOT NULL DEFAULT 'local',
  lifecycle_state varchar(20) NOT NULL DEFAULT 'active',
  lifecycle_reason text,
  lifecycle_changed_at timestamptz,
  lifecycle_changed_by varchar(255),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE user_management.organization_users (
  organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id varchar(255) NOT NULL,
  role varchar(50) NOT NULL DEFAULT 'member',
  permissions jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  invited_by varchar(255),
  invited_at timestamptz,
  joined_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT organization_users_user_id_organization_id_idx UNIQUE (user_id, organization_id)
);

CREATE TABLE user_management.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255),
  event_type varchar(50) NOT NULL,
  ip_address varchar(45),
  user_agent text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  actor_user_id text NOT NULL,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  hash text NOT NULL,
  previous_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  hash_version text NOT NULL DEFAULT 'linkage-only-v0',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
