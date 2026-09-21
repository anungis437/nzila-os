-- =============================================================================
-- 20260921_workbook_credential_and_payment_authority.sql
--
-- Union Eyes — PostgreSQL enforcement of workbook claim-credential and
-- payment-fulfillment authority (forward migration only).
--
-- Rollback companion:
--   20260921_workbook_credential_and_payment_authority_rollback.sql
--
-- Context
-- -------
-- The Stripe workbook-fulfillment path (app/api/payments/webhooks/stripe/
-- route.ts) and the workbook-claim path (app/api/workbook/[id]/claim/
-- route.ts) both execute exclusively under withSystemContext() — i.e. on the
-- separate `systemDb` connection authenticated as the `union_eyes_system`
-- role (see lib/db/with-rls-context.ts and 0108_rls_tenant_isolation_
-- foundation.sql). Application-layer discipline alone previously guaranteed
-- that ordinary tenant runtime (`union_eyes_runtime`) never manufactured a
-- claim credential or the durable Stripe payment identity. This migration
-- moves that guarantee into PostgreSQL so it holds regardless of the calling
-- code path.
--
-- Mutation inventory (Phase 2 — writers of `workbooks`, derived from source)
-- -------------------------------------------------------------------------
--   * app/api/workbook/start/route.ts        (TENANT_RUNTIME)  INSERT only;
--       sets locale/consent/sector/size/utm — NONE of the protected fields.
--   * app/api/payments/webhooks/stripe/route.ts (SYSTEM) UPDATE report_tier_id,
--       stripe_payment_ref, claim_email, claim_token, claim_token_expires_at,
--       status, updated_at; INSERT workbook_purchases (reservation).
--   * app/api/workbook/[id]/claim/route.ts   (SYSTEM)  UPDATE claimed_by_*,
--       claimed_at, status, claim_token -> NULL, claim_token_expires_at -> NULL.
--
-- Field authority decided from that inventory:
--   claim_token              -> FULFILLMENT/CLAIM SYSTEM_OWNED  (system-only)
--   claim_token_expires_at   -> FULFILLMENT/CLAIM SYSTEM_OWNED  (system-only)
--   stripe_payment_ref       -> FULFILLMENT SYSTEM_OWNED        (system-only)
--   status                   -> RUNTIME_MUTABLE (legitimately changes at claim)
--   report_tier_id/claim_email/claimed_* -> not enforced this pass (the
--     claimed-workbook access chain — verifyClaimedWorkbookAccess/same-org —
--     is the explicit next tranche; over-protecting here is out of scope).
--
-- What this migration does NOT do: it does not rewrite 0108 or any round58
-- RLS foundation, does not touch RLS policies, and does not alter the
-- webhook or claim application handlers.
--
-- Idempotent: safe to re-run. Prerequisite: 0108 (roles) and round58
-- (workbook grants/policies) already applied.
-- =============================================================================

-- =============================================================================
-- PART 1 — System-principal predicate
--
-- True only when the current PostgreSQL principal is `union_eyes_system` — the
-- role the bounded withSystemContext() connection authenticates as directly
-- (systemDb; see lib/db/with-rls-context.ts and 0108). This is the SOLE
-- accepted application authority for mutating system-owned workbook fields.
--
-- PostgreSQL superuser / BYPASSRLS status is deliberately NOT encoded as an
-- application authority path: administrative power exists independently of the
-- business authorization model and must not be conflated with it. The trigger
-- function below is SECURITY INVOKER (the default), so current_user is the
-- calling principal, not the function owner. `union_eyes_runtime` is not
-- `union_eyes_system`, so it is rejected.
-- =============================================================================

CREATE OR REPLACE FUNCTION ue_is_workbook_system_principal()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_user = 'union_eyes_system';
$$;

-- =============================================================================
-- PART 2 — Trigger function enforcing credential + payment-identity authority
--
-- BEFORE INSERT OR UPDATE, per row:
--   (a) Credential-pair consistency (ALL principals): claim_token and
--       claim_token_expires_at must be both NULL or both non-NULL. No half-
--       populated credential pair may ever be persisted.
--   (b) Credential mutation (issue/rotate/clear) requires a system principal.
--   (c) stripe_payment_ref creation/replacement requires a system principal.
-- =============================================================================

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

-- =============================================================================
-- PART 3 — Grant corrections
--
-- The reservation-first Stripe fulfillment transaction and the claim
-- transaction both run as `union_eyes_system` and:
--   * SELECT workbooks         — existence pre-read + guarded UPDATE whose
--                                WHERE / RETURNING read columns (id,
--                                stripe_payment_ref, claim_token). PostgreSQL
--                                requires SELECT on any column read by an
--                                UPDATE's predicate or RETURNING list, so
--                                UPDATE alone is insufficient.
--   * SELECT workbook_purchases — resolve the conflicting purchase by
--                                 stripe_payment_ref after ON CONFLICT.
--   * INSERT workbook_purchases — reservation (already granted in round58).
--
-- Runtime keeps SELECT/INSERT/UPDATE on workbooks (creation via
-- workbook/start + the field-level trigger now bars protected-field abuse);
-- runtime retains ZERO privileges on workbook_purchases — no product path
-- reads or writes it as the tenant principal.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('workbooks') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE workbooks FROM union_eyes_runtime';
    EXECUTE 'REVOKE ALL ON TABLE workbooks FROM union_eyes_system';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE workbooks TO union_eyes_runtime';
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE workbooks TO union_eyes_system';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('workbook_purchases') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE workbook_purchases FROM union_eyes_runtime';
    EXECUTE 'REVOKE ALL ON TABLE workbook_purchases FROM union_eyes_system';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE workbook_purchases TO union_eyes_system';
  END IF;
END
$$;
