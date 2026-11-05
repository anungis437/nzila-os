-- PLATFORM_SQL 0037_workaid_referral_scope
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- The categories named on a referral are the referral's own scope. They are not
-- copied from the member's consent, which may be broader. The column is written
-- once, on insert, and the existing update guard refuses to change it. A row
-- created before this column existed stays null; readers must fail closed
-- rather than reconstruct the scope. This migration inserts no consent wording
-- and does not contact counsel.

DO $$
BEGIN
  IF to_regclass('public.ue_authority_workaid_matters') IS NULL
     OR to_regprocedure('ue_authority_guard_update()') IS NULL THEN
    RAISE EXCEPTION 'platform 0037 fail-closed: union-side WorkAid referral storage is not installed.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE ue_authority_workaid_matters
  ADD COLUMN IF NOT EXISTS referred_categories text[];
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ue_authority_workaid_referred_categories_chk'
       AND conrelid = 'public.ue_authority_workaid_matters'::regclass
  ) THEN
    ALTER TABLE ue_authority_workaid_matters
      ADD CONSTRAINT ue_authority_workaid_referred_categories_chk CHECK (
        referred_categories IS NULL
        OR (
          cardinality(referred_categories) BETWEEN 1 AND 8
          AND NOT ('*' = ANY (referred_categories))
        )
      );
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_authority_workaid_require_referral_scope() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.referred_categories IS NULL
     OR cardinality(NEW.referred_categories) < 1
     OR cardinality(NEW.referred_categories) > 8
     OR '*' = ANY (NEW.referred_categories)
     OR EXISTS (SELECT 1 FROM unnest(NEW.referred_categories) AS u(c) GROUP BY c HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'REFERRAL_SCOPE_REQUIRED: a referral must record the categories that were referred' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_workaid_require_referral_scope ON ue_authority_workaid_matters;
--> statement-breakpoint
CREATE TRIGGER ue_authority_workaid_require_referral_scope
  BEFORE INSERT ON ue_authority_workaid_matters
  FOR EACH ROW EXECUTE FUNCTION ue_authority_workaid_require_referral_scope();
