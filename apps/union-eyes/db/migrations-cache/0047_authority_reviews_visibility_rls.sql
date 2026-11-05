-- 0047_authority_reviews_visibility_rls
--
-- Row visibility for the governance review register. 0020 gave ue_authority_reviews the organization-only policy, so any query
-- that ran in an organization context could read every review of that organization: its complainant, its adverse parties and
-- its privileged classification. The rules that hide a review from its adverse party and show an overseer only the reviews a
-- live mandate names lived in lib/authority/store/review-intake.ts alone.
--
-- This adds ONE restrictive SELECT policy for the runtime role. It narrows the organization policy; it never widens it, and a
-- re-run of 0020 (which recreates only the ue_org_isolation_* policies) cannot undo it. A review row is visible to the
-- authenticated principal (app.current_user_id) only when that principal is NOT named as an adverse party and either
--
--   * opened the review or is its complainant, or
--   * holds a live governance_review mandate whose scope names this review and who has not recused from it.
--
-- "Live" is the kernel's own test (lib/authority/common.ts liveness and assessMandate): status active, not revoked, inside its
-- effective window, and accepted when acceptance is required. Any power on the mandate suffices here, because every oversight
-- action has to load the row to be decided; which power an action needs stays the kernel's decision, and the oversight list
-- keeps its additional monitor-power filter. The kernel still denies a complainant, an adverse party and a recused principal
-- on its own; the database now also refuses to show them the row, so a non-visible review is reported as not found and a
-- denial never confirms that a review names someone as a respondent.
--
-- Not changed: INSERT and UPDATE stay organization-scoped (the actor-binding triggers of platform 0013 already bind
-- opened_by to the session principal), the append-only guards, and every grant. An INSERT ... RETURNING of a review that names
-- its own opener as adverse is refused by this policy, because the opener could not see the row they just wrote.
--
-- The event history is the same data by another route. ue_authority_events holds a full snapshot (row_before, row_after) of
-- every authority row the recording trigger saw, plus the acting principal, and the runtime role may read it for the whole
-- organization, so a member could read each review's complainant, adverse parties and classification there. A second
-- restrictive policy makes an event of a review exactly as visible as the review: the events of reviews the principal can
-- see, and every other event unchanged. The subquery is itself subject to the review policy above, so the two cannot drift.
-- The audit reconciliation (lib/authority/store/audit.ts) is an integrity check and must read every event; it therefore runs
-- as the migration owner or another role that bypasses row-level security, not as the tenant runtime role.
--
-- Not enforced here: which columns a legitimate reader projects (the oversight list never carries respondent identifiers), the
-- member's active standing and the governance_reviewer capacity (the organization binding and the kernel decide those), and
-- the visibility of mandate and recusal rows, which the kernel reads for delegation facts and which stay organization-scoped.
--
-- The principal is compared as text and an unset or empty app.current_user_id matches nothing, so a missing context fails closed.

DO $$
BEGIN
  IF to_regclass('public.ue_authority_reviews') IS NULL THEN
    RAISE EXCEPTION 'RLS 0047 fail-closed: public.ue_authority_reviews does not exist (platform 0013 not applied).';
  END IF;
  IF to_regclass('public.ue_authority_events') IS NULL
     OR to_regclass('public.ue_authority_mandates') IS NULL
     OR to_regclass('public.ue_authority_acceptances') IS NULL
     OR to_regclass('public.ue_authority_recusals') IS NULL THEN
    RAISE EXCEPTION 'RLS 0047 fail-closed: the event, mandate, acceptance or recusal relation does not exist (platform 0013 not applied).';
  END IF;
  IF to_regrole('union_eyes_runtime') IS NULL THEN
    RAISE EXCEPTION 'RLS 0047 fail-closed: role union_eyes_runtime does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ue_authority_reviews' AND policyname = 'ue_org_isolation_select'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ue_authority_events' AND policyname = 'ue_org_isolation_select'
  ) THEN
    RAISE EXCEPTION 'RLS 0047 fail-closed: the organization policy (0020) is not installed on the review register or the event history.';
  END IF;
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ue_authority_reviews'
      AND column_name IN ('organization_id', 'opened_by', 'complainant_user_id', 'adverse_user_ids')
  ) <> 4 THEN
    RAISE EXCEPTION 'RLS 0047 fail-closed: ue_authority_reviews does not have the expected participant columns.';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_authority_reviews_visibility ON public.ue_authority_reviews;
--> statement-breakpoint
CREATE POLICY ue_authority_reviews_visibility ON public.ue_authority_reviews
  AS RESTRICTIVE
  FOR SELECT
  TO union_eyes_runtime
  USING (
    nullif(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND NOT (nullif(current_setting('app.current_user_id', true), '') = ANY (adverse_user_ids))
    AND (
      opened_by = nullif(current_setting('app.current_user_id', true), '')
      OR complainant_user_id = nullif(current_setting('app.current_user_id', true), '')
      OR EXISTS (
        SELECT 1
          FROM public.ue_authority_mandates m
         WHERE m.organization_id = ue_authority_reviews.organization_id
           AND m.principal_user_id = nullif(current_setting('app.current_user_id', true), '')
           AND m.kind = 'governance_review'
           AND m.status = 'active'
           AND m.revoked_at IS NULL
           AND m.effective_at <= now()
           AND m.expires_at > now()
           AND jsonb_typeof(m.scope -> 'resourceIds') = 'array'
           AND (m.scope -> 'resourceIds') @> jsonb_build_array(ue_authority_reviews.id::text)
           AND (
             NOT m.requires_acceptance
             OR EXISTS (
               SELECT 1
                 FROM public.ue_authority_acceptances a
                WHERE a.organization_id = m.organization_id
                  AND a.instrument_type = 'mandate'
                  AND a.instrument_id = m.id
                  AND a.accepted_at <= now()
             )
           )
           AND NOT EXISTS (
             SELECT 1
               FROM public.ue_authority_recusals rc
              WHERE rc.organization_id = ue_authority_reviews.organization_id
                AND rc.principal_user_id = m.principal_user_id
                AND rc.resource_type = 'governance_review'
                AND rc.resource_id = ue_authority_reviews.id
                AND rc.lifted_at IS NULL
           )
      )
    )
  );
--> statement-breakpoint
DROP POLICY IF EXISTS ue_authority_events_review_visibility ON public.ue_authority_events;
--> statement-breakpoint
CREATE POLICY ue_authority_events_review_visibility ON public.ue_authority_events
  AS RESTRICTIVE
  FOR SELECT
  TO union_eyes_runtime
  USING (
    source_table <> 'ue_authority_reviews'
    OR EXISTS (
      SELECT 1
        FROM public.ue_authority_reviews r
       WHERE r.id = ue_authority_events.source_id
         AND r.organization_id = ue_authority_events.organization_id
    )
  );
