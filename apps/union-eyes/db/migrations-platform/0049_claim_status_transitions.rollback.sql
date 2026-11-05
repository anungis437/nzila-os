-- Rollback for 0049_claim_status_transitions. The transition history is discarded and the status_changed_at moments with it; export
-- them first if the SLA clock must be reconstructed. The claims rows themselves are otherwise untouched.
DROP TRIGGER IF EXISTS ue_claims_record_status_transition ON public.claims;
DROP TRIGGER IF EXISTS ue_claims_stamp_status_changed ON public.claims;
DROP FUNCTION IF EXISTS public.ue_claims_record_status_transition();
DROP FUNCTION IF EXISTS public.ue_claims_stamp_status_changed();
DROP TABLE IF EXISTS public.claim_status_transitions;
ALTER TABLE IF EXISTS public.claims DROP COLUMN IF EXISTS status_changed_at;
