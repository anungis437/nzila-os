-- Round 58 Phase 0 (corrected): close the final storage-authority blocker
-- for strike_fund_disbursements by giving it a real, auditable
-- organization_id reflecting HISTORICAL economic ownership, not present-day
-- membership.
--
-- Prior state: user_id only, no organization_id column at all. The two live
-- readers (app/api/finance/summary/route.ts, lib/ai/financial-insights.ts)
-- worked around this by joining organization_members on user_id at query
-- time — which is also unsafe (a member with more than one
-- organization_members row would fan out the aggregate).
--
-- CORRECTION (Round 58 review): an earlier version of this migration backfilled
-- using "the organization the user currently has exactly one
-- organization_members row for" — a present-day-membership snapshot. That is
-- NOT equivalent to historical ownership: a member who joined organization B
-- after a disbursement was paid while a member of organization A would be
-- backfilled to B, silently misattributing the payment. This version instead
-- requires the organization_members row to have been EFFECTIVE AT THE
-- DISBURSEMENT'S OWN payment_date (joined_at <= payment_date AND (deleted_at
-- IS NULL OR deleted_at > payment_date)), evaluated independently per
-- disbursement row, not per user.
--
-- strike_fund_disbursements.strike_id was evaluated as a potentially
-- stronger provenance root (disbursement -> strike -> organization) per the
-- Round 58 review. No "strikes"/strike-fund parent table exists anywhere in
-- this schema for strike_id to resolve against (confirmed via exhaustive
-- schema grep across db/schema/**); the column is unconstrained and has zero
-- real writers (see services/tax-slip-service.ts — the sole writer has no
-- production callers). It therefore carries no trustworthy tenant ownership
-- and cannot serve as a provenance root; organization_members (with the
-- effective-at-payment-date predicate below) is the only available
-- historical-provenance source.
--
-- This migration:
--   1. adds organization_id as NULLABLE first (never a blind NOT NULL add)
--   2. deterministically backfills ONLY rows with EXACTLY ONE
--      organization_members row that was effective at that row's own
--      payment_date — no COALESCE/LIMIT 1/MIN(org_id)/is_primary/
--      current-membership/default-tenant shortcuts
--   3. raises an exception (aborting the whole transaction) if any row
--      remains ambiguous (>1 effective-at-payment-date candidate) or
--      unmapped (0 candidates) after the deterministic backfill — this
--      migration refuses to silently guess or fall back to present-day
--      membership
--   4. only then enforces NOT NULL + FK + index

BEGIN;

ALTER TABLE strike_fund_disbursements
  ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Deterministic, per-disbursement, effective-at-payment-date backfill: for
-- each disbursement row, find every organization_members row for the same
-- user_id whose [joined_at, deleted_at) interval contains the disbursement's
-- own payment_date. Only disbursements with EXACTLY ONE such candidate are
-- updated; zero or multiple candidates are left NULL and caught by the
-- ambiguity check below — never guessed, never resolved by picking a
-- present-day/default/primary membership.
WITH historically_effective_membership AS (
  SELECT
    sfd.id AS disbursement_id,
    o.id AS candidate_organization_id
  FROM strike_fund_disbursements sfd
  JOIN organization_members om
    ON om.user_id = sfd.user_id
   AND om.joined_at <= sfd.payment_date
   AND (om.deleted_at IS NULL OR om.deleted_at > sfd.payment_date)
  JOIN organizations o ON o.slug = om.organization_id
  WHERE sfd.organization_id IS NULL
),
disbursement_candidates AS (
  SELECT
    disbursement_id,
    COUNT(DISTINCT candidate_organization_id) AS candidate_count,
    -- uuid has no MIN/MAX aggregate; array_agg(DISTINCT ...)[1] is only ever
    -- read below when candidate_count = 1, so this extracts the single
    -- candidate value, not resolving ambiguity between several.
    (array_agg(DISTINCT candidate_organization_id))[1] AS sole_candidate_organization_id
  FROM historically_effective_membership
  GROUP BY disbursement_id
)
UPDATE strike_fund_disbursements sfd
SET organization_id = dc.sole_candidate_organization_id
FROM disbursement_candidates dc
WHERE sfd.id = dc.disbursement_id
  AND dc.candidate_count = 1
  AND sfd.organization_id IS NULL;

DO $$
DECLARE
  ambiguous_or_unmapped_count integer;
BEGIN
  SELECT COUNT(*) INTO ambiguous_or_unmapped_count
  FROM strike_fund_disbursements
  WHERE organization_id IS NULL;

  IF ambiguous_or_unmapped_count > 0 THEN
    RAISE EXCEPTION
      'strike_fund_disbursements organization_id backfill left % row(s) with zero or ambiguous (>1) organization_members candidates effective at their own payment_date — refusing to enforce NOT NULL. '
      'This is expected and correct if no historically-valid provenance can be proven; do not add a fallback/default/current-membership shortcut here. '
      'Resolve each row''s true owning organization at its payment_date manually before re-running this migration.',
      ambiguous_or_unmapped_count;
  END IF;
END $$;

ALTER TABLE strike_fund_disbursements
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE strike_fund_disbursements
  ADD CONSTRAINT strike_fund_disbursements_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS strike_fund_disbursements_organization_id_idx
  ON strike_fund_disbursements(organization_id);

COMMIT;
