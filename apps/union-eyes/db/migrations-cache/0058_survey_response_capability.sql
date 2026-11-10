-- 0058_survey_response_capability
--
-- DEF-0B5-SURVEY-RESPONSES-IDENTIFIED-OR-ANONYMOUS-RESPONSE-MUTATION-AUTHORITY.
-- survey_responses gains response_token_hash (text, nullable): the SHA-256 hash of a high-entropy capability token
-- issued exactly once, at response creation, for an anonymous response (user_id NULL). The answers and completion
-- routes verify a presented token against this hash before allowing any mutation of an anonymous response; a bare
-- response id is not sufficient authority. An identified response (user_id set) continues to be authorized by
-- ownership alone and never has a token issued. The raw token itself is never stored, only its hash.
DO $$
BEGIN
  IF to_regclass('public.survey_responses') IS NULL THEN
    RAISE EXCEPTION 'cache 0058 fail-closed: public.survey_responses does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "response_token_hash" text;
