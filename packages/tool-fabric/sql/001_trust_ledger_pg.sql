-- P0 #1037: durable, append-only trust ledger. Run via approved DB migration
-- authority only. The application must not auto-create/repair this schema.
BEGIN;
CREATE TABLE IF NOT EXISTS tool_fabric_trust_stream (
  stream_id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  head_hash CHAR(64) NOT NULL CHECK (head_hash ~ '^[a-f0-9]{64}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tool_fabric_trust_entry (
  stream_id TEXT NOT NULL REFERENCES tool_fabric_trust_stream(stream_id) ON DELETE RESTRICT,
  seq BIGINT NOT NULL CHECK (seq > 0),
  audit_id UUID NOT NULL UNIQUE,
  entry_hash CHAR(64) NOT NULL UNIQUE CHECK (entry_hash ~ '^[a-f0-9]{64}$'),
  entry JSONB NOT NULL CHECK (jsonb_typeof(entry) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, seq)
);
-- The single canonical stream is created with genesis head. No silent reset.
INSERT INTO tool_fabric_trust_stream (stream_id, revision, head_hash)
VALUES ('platform:tool-fabric:trust', 0, repeat('0',64))
ON CONFLICT (stream_id) DO NOTHING;

-- The application role must have SELECT on stream and entry, UPDATE on
-- trust_stream, and INSERT on trust_entry only. No DELETE/TRUNCATE/DDL.
-- Grant control is intentionally left to the separately governed DBA.
-- Database-side tamper protections, PITR and independent witness validation
-- remain release prerequisites (not conferred by this migration).
COMMIT;
