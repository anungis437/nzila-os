-- 0030_precedent_explicit_share_select rollback: remove the multi-party read policy; the owner-only policies from 0012 remain.
DROP POLICY IF EXISTS ue_precedent_shared_select ON public.arbitration_precedents;
