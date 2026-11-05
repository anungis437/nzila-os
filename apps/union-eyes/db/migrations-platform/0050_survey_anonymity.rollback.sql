-- Rollback for 0050_survey_anonymity. The anonymization trigger, the check and the responded record are removed. The links that were
-- discarded for anonymous responses are NOT restored (they were discarded on purpose). member_id and claim_id are made NOT NULL again
-- only when no row is without them; otherwise the rollback fails closed and leaves them nullable.
DROP TRIGGER IF EXISTS ue_satisfaction_anonymize_response ON public.satisfaction_surveys;
DROP FUNCTION IF EXISTS public.ue_satisfaction_anonymize_response();
ALTER TABLE IF EXISTS public.satisfaction_surveys DROP CONSTRAINT IF EXISTS satisfaction_surveys_anonymous_unlinked_check;
DROP TABLE IF EXISTS public.satisfaction_survey_responded;
DO $$
DECLARE
  was_forced boolean;
  unlinked boolean;
BEGIN
  IF to_regclass('public.satisfaction_surveys') IS NULL THEN
    RETURN;
  END IF;
  -- Under FORCE ROW LEVEL SECURITY the owner sees no row, so the check must look past it or it would pass on a table full of nulls.
  SELECT relforcerowsecurity INTO was_forced FROM pg_class WHERE oid = 'public.satisfaction_surveys'::regclass;
  IF was_forced THEN
    ALTER TABLE public.satisfaction_surveys NO FORCE ROW LEVEL SECURITY;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.satisfaction_surveys WHERE member_id IS NULL OR claim_id IS NULL) INTO unlinked;
  IF was_forced THEN
    ALTER TABLE public.satisfaction_surveys FORCE ROW LEVEL SECURITY;
  END IF;
  IF NOT unlinked THEN
    ALTER TABLE public.satisfaction_surveys ALTER COLUMN member_id SET NOT NULL;
    ALTER TABLE public.satisfaction_surveys ALTER COLUMN claim_id SET NOT NULL;
  END IF;
END $$;
