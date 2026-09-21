-- 0013_workbook_credential_payment_authority.rollback
--
-- Reverse of 0013_workbook_credential_payment_authority.sql. Removes ONLY the
-- objects 0013 owns: the credential/payment-identity trigger and its two helper
-- functions. Does NOT touch grants (owned by 0009), RLS policies (owned by
-- 0010-0012), roles, or any unrelated object. No CASCADE.
--
-- SECURITY NOTE: running this rollback re-opens the exact defect this migration
-- closed (an owning union_eyes_runtime principal could again mutate the system-
-- owned claim_token / claim_token_expires_at / stripe_payment_ref). It is
-- therefore TEST/DEVELOPMENT-ONLY and must never be applied to a governed
-- (production/staging) database.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF to_regclass('workbooks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks;
  END IF;
END
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_enforce_workbook_credential_authority();
--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_is_workbook_system_principal();
