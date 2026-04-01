-- Migration: Audit log immutability — prevent DELETE/UPDATE on review decision records
-- and CBA intelligence audit tables.
--
-- Uses BEFORE DELETE OR UPDATE triggers to raise exceptions,
-- ensuring all review decisions are append-only (immutable once inserted).
-- Also adds sha256 hash-chain column to review_decisions for tamper detection.

BEGIN;

-- ── 1. Add audit_hash column for hash-chain on review decisions ─────────────
ALTER TABLE cba_intel_review_decisions
  ADD COLUMN IF NOT EXISTS audit_hash varchar(64);

-- ── 2. Trigger function: deny mutation on immutable audit tables ─────────────
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable — % on % is not permitted',
    TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- ── 3. Apply immutability trigger to cba_intel_review_decisions ─────────────
DROP TRIGGER IF EXISTS trg_cba_intel_review_decisions_immutable
  ON cba_intel_review_decisions;

CREATE TRIGGER trg_cba_intel_review_decisions_immutable
  BEFORE DELETE OR UPDATE ON cba_intel_review_decisions
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

-- ── 4. Hash-chain function: compute SHA-256 of previous row + new row ───────
CREATE OR REPLACE FUNCTION cba_intel_review_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prev_hash text;
BEGIN
  SELECT audit_hash INTO prev_hash
  FROM cba_intel_review_decisions
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.audit_hash := encode(
    sha256(
      convert_to(
        COALESCE(prev_hash, '0') || '|' ||
        NEW.target_type || '|' ||
        NEW.target_id || '|' ||
        NEW.decision || '|' ||
        NEW.reviewer_id || '|' ||
        NEW.created_at::text,
        'UTF8'
      )
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

-- ── 5. Apply hash-chain trigger BEFORE INSERT ───────────────────────────────
-- NOTE: Must be created BEFORE the immutability trigger takes effect on INSERT
DROP TRIGGER IF EXISTS trg_cba_intel_review_hash_chain
  ON cba_intel_review_decisions;

CREATE TRIGGER trg_cba_intel_review_hash_chain
  BEFORE INSERT ON cba_intel_review_decisions
  FOR EACH ROW
  EXECUTE FUNCTION cba_intel_review_hash_chain();

COMMIT;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_cba_intel_review_decisions_immutable ON cba_intel_review_decisions;
-- DROP TRIGGER IF EXISTS trg_cba_intel_review_hash_chain ON cba_intel_review_decisions;
-- DROP FUNCTION IF EXISTS deny_audit_mutation();
-- DROP FUNCTION IF EXISTS cba_intel_review_hash_chain();
-- ALTER TABLE cba_intel_review_decisions DROP COLUMN IF EXISTS audit_hash;
-- COMMIT;
