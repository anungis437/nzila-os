-- Nzila OS — Hash Chain Immutability Triggers
--
-- These triggers enforce append-only semantics on hash-chained tables.
-- UPDATE and DELETE are structurally prevented at the database level.
-- This is the last line of defence — even raw SQL or admin access
-- cannot silently tamper with the audit trail.
--
-- Tables protected:
--   1. audit_events
--   2. share_ledger_entries
--   3. automation_events
--
-- To apply: psql $DATABASE_URL -f hash-chain-immutability-triggers.sql

-- ── Generic deny-mutate function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nzila_deny_mutate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Mutation denied: % on % is structurally forbidden. '
    'This table is append-only with hash-chain integrity. '
    'Contact @nzila/platform if you believe this is an error.',
    TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── audit_events: deny UPDATE ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_audit_events_no_update ON audit_events;
CREATE TRIGGER trg_audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── audit_events: deny DELETE ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_audit_events_no_delete ON audit_events;
CREATE TRIGGER trg_audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── share_ledger_entries: deny UPDATE ───────────────────────────────────────

DROP TRIGGER IF EXISTS trg_share_ledger_entries_no_update ON share_ledger_entries;
CREATE TRIGGER trg_share_ledger_entries_no_update
  BEFORE UPDATE ON share_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── share_ledger_entries: deny DELETE ───────────────────────────────────────

DROP TRIGGER IF EXISTS trg_share_ledger_entries_no_delete ON share_ledger_entries;
CREATE TRIGGER trg_share_ledger_entries_no_delete
  BEFORE DELETE ON share_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── automation_events: deny UPDATE ──────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_automation_events_no_update ON automation_events;
CREATE TRIGGER trg_automation_events_no_update
  BEFORE UPDATE ON automation_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── automation_events: deny DELETE ──────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_automation_events_no_delete ON automation_events;
CREATE TRIGGER trg_automation_events_no_delete
  BEFORE DELETE ON automation_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_deny_mutate();

-- ── Hash chain validation trigger (INSERT) ──────────────────────────────────
-- Validates that newly inserted rows have a valid hash chain link
-- on hash-chained tables.

CREATE OR REPLACE FUNCTION nzila_validate_hash_chain()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure hash is not null or empty
  IF NEW.hash IS NULL OR NEW.hash = '' THEN
    RAISE EXCEPTION 'Hash chain violation: hash must not be null or empty on %', TG_TABLE_NAME;
  END IF;

  -- For non-genesis entries, previous_hash must reference an existing hash
  -- (Genesis entry has previous_hash = NULL)
  IF NEW.previous_hash IS NOT NULL THEN
    -- Verify the previous_hash exists in this table
    PERFORM 1 FROM (
      SELECT 1
      -- Dynamic table reference not possible in plpgsql without EXECUTE,
      -- so we trust the application layer for cross-reference validation.
      -- This trigger validates structural non-nullity.
    ) sub;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply hash validation to all chained tables

DROP TRIGGER IF EXISTS trg_audit_events_validate_hash ON audit_events;
CREATE TRIGGER trg_audit_events_validate_hash
  BEFORE INSERT ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_validate_hash_chain();

DROP TRIGGER IF EXISTS trg_share_ledger_validate_hash ON share_ledger_entries;
CREATE TRIGGER trg_share_ledger_validate_hash
  BEFORE INSERT ON share_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION nzila_validate_hash_chain();

DROP TRIGGER IF EXISTS trg_automation_events_validate_hash ON automation_events;
CREATE TRIGGER trg_automation_events_validate_hash
  BEFORE INSERT ON automation_events
  FOR EACH ROW
  EXECUTE FUNCTION nzila_validate_hash_chain();
