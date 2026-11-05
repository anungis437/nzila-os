-- Rollback of 0047_authority_reviews_visibility_rls: the review register and its event history return to the organization-only policy of 0020.
DROP POLICY IF EXISTS ue_authority_events_review_visibility ON public.ue_authority_events;
DROP POLICY IF EXISTS ue_authority_reviews_visibility ON public.ue_authority_reviews;
