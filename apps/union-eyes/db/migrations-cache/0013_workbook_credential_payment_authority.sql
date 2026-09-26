-- 0013_workbook_credential_payment_authority
--
-- Ports the ACCEPTED workbook claim-credential / payment-identity authority
-- control into the governed scoped lineage. The identical control ships in the
-- FROZEN legacy migration db/migrations/20260921_workbook_credential_and_
-- payment_authority.sql, which the governed bootstrap never replays — so the
-- shipped scoped database (0000-0012) lacked it, leaving the system-owned
-- workbook columns (claim_token, claim_token_expires_at, stripe_payment_ref)
-- mutable by an owning union_eyes_runtime principal. This migration closes that
-- gap by materializing the SAME trigger + helper predicate the accepted source-
-- security design specifies. It is a straight port of the legacy semantics; it
-- does NOT redesign the control.
--
-- Scope discipline (AUTHORITY CONTROL ONLY):
--   * Defines the system-principal predicate + the BEFORE INSERT/UPDATE trigger
--     that make claim_token / claim_token_expires_at / stripe_payment_ref
--     system-owned and enforce credential-pair consistency for ALL principals.
--   * Does NOT alter grants — the scoped lineage (0009 baseline grants, carried
--     through 0010-0012) already grants union_eyes_system the SELECT it needs
--     for the fulfillment UPDATE ... WHERE/RETURNING path; re-issuing the legacy
--     round58 grant corrections here would REVOKE scoped privileges (a
--     regression) and blur ownership. Grants remain owned by 0009.
--   * Does NOT touch RLS policies (0010-0012 own row-level authorization).
--   * Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE
--     TRIGGER — safe on a fresh scoped DB and on a DB that already received the
--     frozen legacy control (deterministically replaces the exact owned trigger;
--     never CASCADE). An incompatible same-name function signature makes
--     CREATE OR REPLACE hard-fail (fail-closed), which is intended.
--
-- Protected columns: claim_token, claim_token_expires_at, stripe_payment_ref.
-- Runtime-mutable (unprotected): status and all non-listed columns.
-- Legitimate transitions: withSystemContext() (union_eyes_system) — the Stripe
-- webhook fulfillment route and the workbook claim route.

-- PART 1 — System-principal predicate. True only when the current PostgreSQL
-- principal is union_eyes_system (the bounded withSystemContext connection).
-- SECURITY INVOKER (default): current_user is the caller, not the owner.
-- Superuser / BYPASSRLS is deliberately NOT an application-authority path.
CREATE OR REPLACE FUNCTION ue_is_workbook_system_principal()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user = 'union_eyes_system';
$$;
--> statement-breakpoint
-- PART 2 — Trigger function. BEFORE INSERT OR UPDATE, per row:
--   (a) credential-pair consistency (ALL principals): claim_token and
--       claim_token_expires_at must be both NULL or both non-NULL.
--   (b) credential issue/rotate/clear requires a system principal.
--   (c) stripe_payment_ref creation/replacement requires a system principal.
CREATE OR REPLACE FUNCTION ue_enforce_workbook_credential_authority()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_credential_changed boolean;
  v_payment_ref_changed boolean;
BEGIN
  -- (a) Pair consistency — always enforced, regardless of principal.
  IF (NEW.claim_token IS NULL) <> (NEW.claim_token_expires_at IS NULL) THEN
    RAISE EXCEPTION
      'workbook credential pair inconsistent: claim_token and claim_token_expires_at must both be NULL or both be set (workbook %)',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_credential_changed :=
      NEW.claim_token IS NOT NULL OR NEW.claim_token_expires_at IS NOT NULL;
    v_payment_ref_changed := NEW.stripe_payment_ref IS NOT NULL;
  ELSE
    v_credential_changed :=
      NEW.claim_token IS DISTINCT FROM OLD.claim_token
      OR NEW.claim_token_expires_at IS DISTINCT FROM OLD.claim_token_expires_at;
    v_payment_ref_changed :=
      NEW.stripe_payment_ref IS DISTINCT FROM OLD.stripe_payment_ref;
  END IF;

  IF (v_credential_changed OR v_payment_ref_changed)
     AND NOT ue_is_workbook_system_principal() THEN
    RAISE EXCEPTION
      'workbook claim credential and payment identity are system-owned: role % may not issue, rotate, clear, or replace them (workbook %)',
      current_user, NEW.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- PART 3 — Attach the trigger (deterministic replace; guarded on table presence).
DO $$
BEGIN
  IF to_regclass('workbooks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks;
    CREATE TRIGGER ue_workbook_credential_authority
      BEFORE INSERT OR UPDATE ON workbooks
      FOR EACH ROW
      EXECUTE FUNCTION ue_enforce_workbook_credential_authority();
  END IF;
END
$$;
