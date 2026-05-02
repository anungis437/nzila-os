-- NAR audit records (append-only decision proof ledger)

CREATE TABLE IF NOT EXISTS audit_records (
  id text PRIMARY KEY,
  decision_record_id text NOT NULL,
  organization_id text NOT NULL,
  decision_type varchar(255) NOT NULL,
  action_type varchar(255) NOT NULL,
  actor_id text NOT NULL,
  actor_type varchar(32) NOT NULL,
  resource_type varchar(128) NOT NULL,
  resource_id text NOT NULL,
  policy_id varchar(255) NOT NULL,
  policy_version varchar(64) NOT NULL,
  input_hash varchar(128) NOT NULL,
  outcome_hash varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  nar_hash varchar(128) NOT NULL,
  nar_signature text NOT NULL,
  previous_hash varchar(128),
  key_id varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_records_decision_record_id_uidx UNIQUE (decision_record_id)
);

CREATE INDEX IF NOT EXISTS audit_records_org_created_idx ON audit_records (organization_id, created_at);
CREATE INDEX IF NOT EXISTS audit_records_org_decision_idx ON audit_records (organization_id, decision_type);
CREATE INDEX IF NOT EXISTS audit_records_org_action_idx ON audit_records (organization_id, action_type);
CREATE INDEX IF NOT EXISTS audit_records_org_resource_idx ON audit_records (organization_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_records_hash_idx ON audit_records (nar_hash);

CREATE OR REPLACE FUNCTION prevent_audit_records_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_records is append-only — updates are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_audit_records_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_records is append-only — deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_records_no_update ON audit_records;
CREATE TRIGGER trg_audit_records_no_update
  BEFORE UPDATE ON audit_records
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_records_update();

DROP TRIGGER IF EXISTS trg_audit_records_no_delete ON audit_records;
CREATE TRIGGER trg_audit_records_no_delete
  BEFORE DELETE ON audit_records
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_records_delete();
