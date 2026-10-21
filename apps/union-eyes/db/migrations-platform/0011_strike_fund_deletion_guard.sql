-- PLATFORM_SQL — block organization deletion that would erase strike-fund history.
--
-- The historical foreign key stays ON DELETE CASCADE. This trigger aborts the
-- DELETE before that cascade when a disbursement exists. It does not choose a
-- retention period. Ordinary status changes, including deactivation, are
-- unaffected. Reversal is DROP TRIGGER and DROP FUNCTION in a later authorized
-- migration.

CREATE OR REPLACE FUNCTION public.ue_refuse_organization_delete_with_strike_disbursements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.strike_fund_disbursements
    WHERE organization_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'organization delete refused: strike_fund_disbursements history exists for %',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.ue_refuse_organization_delete_with_strike_disbursements() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ue_refuse_organization_delete_with_strike_disbursements() FROM union_eyes_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ue_refuse_organization_delete_with_strike_disbursements() FROM union_eyes_system';
  END IF;
END $$;

DROP TRIGGER IF EXISTS ue_strike_fund_retention_guard ON public.organizations;

CREATE TRIGGER ue_strike_fund_retention_guard
  BEFORE DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.ue_refuse_organization_delete_with_strike_disbursements();
