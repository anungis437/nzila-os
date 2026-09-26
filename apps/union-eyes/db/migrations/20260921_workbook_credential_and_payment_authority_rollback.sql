-- =============================================================================
-- 20260921_workbook_credential_and_payment_authority_rollback.sql
--
-- Reverse of 20260921_workbook_credential_and_payment_authority.sql.
--
-- Removes the credential/payment-identity trigger and its helper functions
-- and restores the round58 (20260910) grant geometry for `workbooks` and
-- `workbook_purchases`:
--   workbooks           -> runtime SELECT,INSERT,UPDATE ; system UPDATE
--   workbook_purchases  -> runtime none                 ; system INSERT
--
-- Idempotent: safe to re-run. Does not touch RLS policies (unchanged by the
-- forward migration).
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('workbooks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS ue_workbook_credential_authority ON workbooks;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS ue_enforce_workbook_credential_authority();
DROP FUNCTION IF EXISTS ue_is_workbook_system_principal();

-- Restore round58 grant geometry.
DO $$
BEGIN
  IF to_regclass('workbooks') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE workbooks FROM union_eyes_runtime';
    EXECUTE 'REVOKE ALL ON TABLE workbooks FROM union_eyes_system';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE workbooks TO union_eyes_runtime';
    EXECUTE 'GRANT UPDATE ON TABLE workbooks TO union_eyes_system';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('workbook_purchases') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE workbook_purchases FROM union_eyes_runtime';
    EXECUTE 'REVOKE ALL ON TABLE workbook_purchases FROM union_eyes_system';
    EXECUTE 'GRANT INSERT ON TABLE workbook_purchases TO union_eyes_system';
  END IF;
END
$$;
