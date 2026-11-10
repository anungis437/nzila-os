-- Rollback for 0058_survey_response_capability
DO $$
BEGIN
  IF to_regclass('public.survey_responses') IS NULL THEN
    RAISE EXCEPTION 'cache 0058 rollback fail-closed: public.survey_responses does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "survey_responses" DROP COLUMN IF EXISTS "response_token_hash";
