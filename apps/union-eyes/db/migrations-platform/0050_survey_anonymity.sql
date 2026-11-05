-- PLATFORM_SQL 0050_survey_anonymity
--
-- The member-facing survey form promises that an anonymous response hides the member's name from the representative, and the
-- satisfaction_surveys row kept member_id, claim_id and exact timestamps whatever the flag said: a representative who knows which
-- claim they handled could name the respondent. This migration makes the promise true in the database, not only in the screens:
--
--   * member_id and claim_id become nullable, and a response that is anonymous and completed is held WITHOUT them: a BEFORE UPDATE
--     trigger clears both when the response completes, drops sent_at and metadata, and coarsens created_at, completed_at and
--     updated_at to the month, so the row can no longer be tied to a claim or a day. A CHECK constraint then refuses any
--     anonymous completed row that still carries a member or a claim.
--   * satisfaction_survey_responded keeps the one fact that must survive: that this member has answered the survey for this claim
--     (unique per claim and member), so the survey cannot be sent or answered twice. It holds no answer, no response id and no
--     timestamp. It is written only by the trigger (SECURITY DEFINER); the application roles read it and cannot change it.
--   * Existing anonymous completed rows are scrubbed the same way. This part cannot be undone: the links are discarded on purpose,
--     because they are what the member was promised would not be kept. The migration fails closed if any such row remains linked.
--
-- A free-text feedback comment can still name someone; that is the respondent's own text and is not altered.
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION. RLS is cache 0040.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.satisfaction_surveys') IS NULL THEN
    RAISE EXCEPTION 'survey anonymity fail-closed: public.satisfaction_surveys does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.satisfaction_survey_responded (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  member_id varchar(255) NOT NULL,
  CONSTRAINT satisfaction_survey_responded_claim_member_uq UNIQUE (claim_id, member_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS satisfaction_survey_responded_org_idx ON public.satisfaction_survey_responded (organization_id);
--> statement-breakpoint
ALTER TABLE public.satisfaction_surveys ALTER COLUMN member_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE public.satisfaction_surveys ALTER COLUMN claim_id DROP NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_satisfaction_anonymize_response() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW.is_anonymous IS TRUE AND NEW.status = 'completed' AND (NEW.member_id IS NOT NULL OR NEW.claim_id IS NOT NULL) THEN
    IF NEW.member_id IS NOT NULL AND NEW.claim_id IS NOT NULL THEN
      -- ON CONFLICT is avoided on purpose: under FORCE ROW LEVEL SECURITY the table owner has no SELECT policy, and ON CONFLICT
      -- needs one. The unique constraint is the arbiter instead; an answer already recorded is not an error.
      BEGIN
        INSERT INTO public.satisfaction_survey_responded (organization_id, claim_id, member_id)
        VALUES (NEW.organization_id, NEW.claim_id, NEW.member_id);
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;
    NEW.member_id := NULL;
    NEW.claim_id := NULL;
    NEW.sent_at := NULL;
    NEW.metadata := '{}'::jsonb;
    NEW.created_at := date_trunc('month', NEW.created_at);
    NEW.completed_at := date_trunc('month', COALESCE(NEW.completed_at, now()));
    NEW.updated_at := date_trunc('month', now());
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
-- A SECURITY DEFINER function is not callable by a runtime principal; a trigger still fires it (EXECUTE is checked when the trigger is created).
REVOKE ALL ON FUNCTION public.ue_satisfaction_anonymize_response() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_satisfaction_anonymize_response ON public.satisfaction_surveys;
--> statement-breakpoint
CREATE TRIGGER ue_satisfaction_anonymize_response BEFORE INSERT OR UPDATE ON public.satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.ue_satisfaction_anonymize_response();
--> statement-breakpoint
DO $$
DECLARE
  remaining bigint;
  was_forced boolean;
BEGIN
  -- Scrub what already exists. The trigger does the work; an UPDATE that changes nothing else fires it. Under FORCE ROW LEVEL
  -- SECURITY the owner sees no row (no policy names it), so the force is lifted for the scrub and restored straight after.
  SELECT relforcerowsecurity INTO was_forced FROM pg_class WHERE oid = 'public.satisfaction_surveys'::regclass;
  IF was_forced THEN
    ALTER TABLE public.satisfaction_surveys NO FORCE ROW LEVEL SECURITY;
  END IF;
  UPDATE public.satisfaction_surveys SET status = status
  WHERE is_anonymous IS TRUE AND status = 'completed' AND (member_id IS NOT NULL OR claim_id IS NOT NULL);
  SELECT count(*) INTO remaining FROM public.satisfaction_surveys
  WHERE is_anonymous IS TRUE AND status = 'completed' AND (member_id IS NOT NULL OR claim_id IS NOT NULL);
  IF was_forced THEN
    ALTER TABLE public.satisfaction_surveys FORCE ROW LEVEL SECURITY;
  END IF;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'survey anonymity fail-closed: % anonymous completed response(s) are still linked to a member or a claim (the scrub could not reach them).', remaining;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'satisfaction_surveys_anonymous_unlinked_check' AND conrelid = 'public.satisfaction_surveys'::regclass) THEN
    ALTER TABLE public.satisfaction_surveys ADD CONSTRAINT satisfaction_surveys_anonymous_unlinked_check
      CHECK (NOT (is_anonymous IS TRUE AND status = 'completed') OR (member_id IS NULL AND claim_id IS NULL));
  END IF;
END $$;
