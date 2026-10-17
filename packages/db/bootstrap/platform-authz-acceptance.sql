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
