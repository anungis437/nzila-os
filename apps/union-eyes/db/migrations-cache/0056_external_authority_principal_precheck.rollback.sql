-- 0056_external_authority_principal_precheck rollback: removes the principal-only SELECT policy. Run only with the external resource middleware's
-- pre-check disabled: without the policy the pre-check finds no authority and every external request is refused (fail closed, nothing exposed).
DO $$
BEGIN
  IF to_regclass('public.representation_authorities') IS NOT NULL THEN
    DROP POLICY IF EXISTS "ue_external_authorities_select_own_principal" ON "representation_authorities";
  END IF;
END $$;
