-- PR #752 round 25: platform-approved commercial terms for pilot_applications.
--
-- Before this migration, commercial-transition sized real contract/invoice
-- amounts from `pilot_applications.member_count` (applicant-supplied at
-- public intake, steward-editable via ordinary PATCH) and selected a
-- subscription plan from `responses.subscriptionPlanId` (never backed by
-- any governed writer) with an ambiguous "pick any active plan" fallback.
-- These columns hold an explicit, platform-approved snapshot that must be
-- set before any financial-artifact-creating transition — see
-- lib/pilot/commercial-terms-authority.ts.

ALTER TABLE pilot_applications
  ADD COLUMN IF NOT EXISTS verified_member_count          integer,
  ADD COLUMN IF NOT EXISTS verified_pilot_amount           numeric(12, 2),
  ADD COLUMN IF NOT EXISTS verified_subscription_plan_id   uuid,
  ADD COLUMN IF NOT EXISTS commercial_terms_approved_by    text,
  ADD COLUMN IF NOT EXISTS commercial_terms_approved_at    timestamptz;

CREATE INDEX IF NOT EXISTS pilot_applications_verified_subscription_plan_idx
  ON pilot_applications (verified_subscription_plan_id);
