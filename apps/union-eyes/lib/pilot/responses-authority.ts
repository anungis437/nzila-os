/**
 * Canonical registry of server/system-reserved keys inside
 * `pilot_applications.responses` (PR #752 round 24).
 *
 * `responses` is a free-form JSONB blob — the public intake form
 * (`app/api/pilot/apply/route.ts`) lets an unauthenticated applicant submit
 * it with ANY keys (`z.record(z.unknown())`). But several platform-governed
 * routes also write SPECIFIC keys into this SAME object as authoritative
 * system/commercial state: the ownership claim, the parallel commercial FSM
 * state, transition history, qualification/opportunity scoring, artifact
 * and reference-profile version metadata, monetization state, and the
 * subscription plan selector commercial-transition reads to pick which
 * billing plan gets activated.
 *
 * Rounds 22/23 protected these keys from being OVERWRITTEN via steward
 * PATCH, but protecting an update is meaningless if the public CREATE path
 * was never sanitized: an unauthenticated applicant could seed
 * `commercialState`/`subscriptionPlanId`/qualification scores/etc directly
 * into a brand-new row, and the PATCH-time protection would then faithfully
 * preserve that attacker-seeded value forever. This module is the SINGLE
 * canonical list both paths use, so there is exactly one place to update
 * when a new governed route starts writing a new `responses` key.
 *
 * Inventory (every route that writes `pilot_applications.responses`,
 * verified via a full-repo scan for `.update(pilotApplications)` under
 * round 24): commercial-transition (`commercialState`,
 * `commercialStateUpdatedAt`, `commercialTransitionHistory`,
 * `pilotIntelligence`, all 7 qualification/opportunity score fields,
 * `pilotQualificationScores`, artifact version fields, `commercialMonetization`,
 * and it also READS `subscriptionPlanId` as the billing-plan selector),
 * `artifacts/route.ts` (artifact version fields only — a subset of the
 * above), `intelligence/route.ts` (`pilotIntelligence` only),
 * `reference-profile/route.ts` (`pilotReferenceVersions`,
 * `latestPilotReferenceVersionId`, `latestPilotReferenceChecksum`,
 * `latestPilotReferenceUpdatedAt` — MISSED entirely in round 23's list).
 * `verify-organization`/`rebind-organization` write `verifiedOrganizationId`
 * (a real column, not a `responses` key — already protected by
 * `blockedPatchFields`, not this registry).
 *
 * `subscriptionPlanId` SUPERSEDED (PR #752 round 25): commercial-transition
 * no longer reads this key at all — it consumes the platform-approved
 * `verifiedSubscriptionPlanId` COLUMN exclusively (set only by
 * `approveCommercialTerms()`, itself protected by `blockedPatchFields`; see
 * `lib/pilot/commercial-terms-authority.ts`), because this `responses` key
 * never had a governed writer to begin with (round 24's own finding) and
 * commercial-transition's prior "pick any active plan" fallback was
 * ambiguous. Left in this list purely as defense-in-depth for any legacy
 * row that already has it set — it is otherwise dead for financial
 * decisions.
 *
 * Deliberately NOT reserved: `championScore`/`activityScore`. Verified via
 * the same full-repo scan that NO route ever WRITES these — every
 * reference is a read (`typeof responses.championScore === 'number' ? ... :
 * undefined`) consumed as an optional, bounded-impact scoring INPUT with a
 * sensible computed fallback when absent (see
 * `calculateCommercialSignals` in `commercialization-wave1.ts`). There is
 * no dedicated governed endpoint that computes and persists them, so
 * reserving them would remove the only way they can ever be set at all.
 * They influence only advisory qualification-score computation, never
 * ownership, FSM transition validity, or financial identity — a materially
 * different risk class from the reserved keys above. This is a deliberate
 * decision, not an oversight: if a future round adds a governed write path
 * for these (or any other new score/insight the system computes), reserve
 * it then.
 */
export const RESERVED_RESPONSES_KEYS = [
  'organizationId',
  'commercialState',
  'commercialStateUpdatedAt',
  'commercialTransitionHistory',
  'pilotIntelligence',
  'pilotFitScore',
  'pilotRiskScore',
  'pilotRevenueScore',
  'pilotReadinessScore',
  'pilotStrategicValueScore',
  'overallOpportunityScore',
  'opportunityTier',
  'pilotQualificationScores',
  'pilotArtifactVersions',
  'latestPilotArtifactVersionId',
  'latestPilotArtifactChecksum',
  'latestPilotArtifactUpdatedAt',
  'pilotReferenceVersions',
  'latestPilotReferenceVersionId',
  'latestPilotReferenceChecksum',
  'latestPilotReferenceUpdatedAt',
  'commercialMonetization',
  'subscriptionPlanId',
] as const;

/**
 * Sanitizes a public intake payload's `responses` blob at CREATE time
 * (`app/api/pilot/apply/route.ts`'s POST) — strips every reserved key
 * EXCEPT `organizationId`, which remains allowed as the intentionally
 * untrusted ownership CLAIM (see `getPilotClaimedOrganizationId`'s doc
 * comment in `lib/pilot/pilot-ownership.ts`; it was always meant to be
 * applicant-supplied, just never trusted as verified ownership).
 */
export function sanitizeResponsesForPublicCreate(
  responses: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const sanitized = { ...(responses ?? {}) };
  for (const key of RESERVED_RESPONSES_KEYS) {
    if (key === 'organizationId') continue;
    delete sanitized[key];
  }
  return sanitized;
}

/**
 * Strips every reserved key from a client-supplied `responses` PATCH
 * fragment, leaving only genuinely applicant/steward-editable keys (PR
 * #752 round 24).
 *
 * Unlike round 22/23's `preserveServerOwnedResponsesFields` (read the
 * row's CURRENT reserved values, copy them into the merged object, then
 * `.set({responses: fullMergedObject})` — replacing the WHOLE column),
 * this never reads or reproduces any reserved key's current value at all.
 * The caller (`lib/api/crud-factory.ts`'s `mergeJsonColumns` support) uses
 * the result as a JSONB MERGE fragment (`responses || fragment`) rather
 * than a full-column replacement: a concurrent platform write to any
 * reserved key can therefore never be reverted by a PATCH that started
 * before it landed, because the PATCH's SQL never mentions that key at
 * all — no lock, re-read, or "preserve the old value" step required to
 * avoid a lost update.
 *
 * `organizationId` (the claim) is preserved by the SAME stripping — a
 * steward PATCH can never set it via this merge fragment either, matching
 * round 22's original protection; the row's existing claim is left
 * completely untouched by the merge (rather than explicitly copied back).
 */
export function stripReservedResponsesKeysForPatch(
  responses: Record<string, unknown>,
): Record<string, unknown> {
  const stripped = { ...responses };
  for (const key of RESERVED_RESPONSES_KEYS) {
    delete stripped[key];
  }
  return stripped;
}
