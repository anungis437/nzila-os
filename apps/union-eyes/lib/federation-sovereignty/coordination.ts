/**
 * Async federation coordination layer.
 *
 * Models cross-federation coordination events:
 *   - continuity-sharing agreements
 *   - joint publication requests
 *   - escalation transfers
 *   - coalition governance
 *   - audit summary sharing
 *
 * All coordination is fire-and-forget and shadow-mode only.
 * No production runtime is blocked or mutated.
 *
 * @module lib/federation-sovereignty/coordination
 */

import type {
  SovereignGovernanceContract,
  FederationCoordinationEvent,
  CoordinationEventType,
  SovereigntyTier,
  ContinuityResilienceScore,
} from './types';

// ── Event builder ─────────────────────────────────────────────────────────────

let _eventCounter = 0;

function nextEventId(): string {
  return `coord_${Date.now()}_${++_eventCounter}`;
}

// ── Continuity sharing ────────────────────────────────────────────────────────

/**
 * Model a continuity-sharing agreement between two federation units.
 *
 * Sharing semantics:
 * - national sees continuity degradation trends
 * - but NOT private local operational details
 * - locals retain operational sovereignty
 */
export function modelContinuitySharing(
  source: SovereignGovernanceContract,
  target: SovereignGovernanceContract,
): FederationCoordinationEvent {
  const hasAuthority = source.delegatedAuthorities.includes('continuity-management');
  const targetIsHigherTier =
    ['national', 'regional'].includes(target.sovereigntyTier) &&
    ['local', 'affiliate'].includes(source.sovereigntyTier);

  const requiresApproval =
    !hasAuthority ||
    source.sovereigntyMode === 'restricted' ||
    source.sovereigntyMode === 'oversight-required';

  const escalationPath: SovereigntyTier[] = targetIsHigherTier
    ? [source.sovereigntyTier, target.sovereigntyTier]
    : [source.sovereigntyTier];

  return {
    eventId: nextEventId(),
    eventType: 'continuity-sharing-request',
    sourceFederationId: source.federationId,
    targetFederationId: target.federationId,
    requiresApproval,
    evidenceRequired: requiresApproval,
    escalationPath,
    diagnostics: {
      sourceMode: source.sovereigntyMode,
      targetTier: target.sovereigntyTier,
      hasAuthority,
      targetIsHigherTier,
      governanceMode: 'shadow',
    },
  };
}

// ── Joint publication ─────────────────────────────────────────────────────────

/**
 * Model a joint publication request between federation units.
 *
 * Joint publications require approval from all participating tiers
 * unless all have unrestricted publication authority.
 */
export function modelJointPublication(
  participants: SovereignGovernanceContract[],
): FederationCoordinationEvent {
  if (participants.length === 0) {
    throw new Error('At least one participant required for joint publication.');
  }

  const allHavePublication = participants.every((p) =>
    p.delegatedAuthorities.includes('publication'),
  );
  const anyRestricted = participants.some((p) =>
    p.overrideRestrictions.includes('publication'),
  );
  const anyOversight = participants.some(
    (p) => p.sovereigntyMode === 'oversight-required',
  );

  const requiresApproval = !allHavePublication || anyRestricted || anyOversight;

  const tiers = [...new Set(participants.map((p) => p.sovereigntyTier))];
  const escalationPath: SovereigntyTier[] = tiers.includes('national')
    ? ['national']
    : tiers.includes('regional')
      ? ['regional', 'national']
      : ['local', 'regional', 'national'];

  return {
    eventId: nextEventId(),
    eventType: 'joint-publication',
    sourceFederationId: participants[0]!.federationId,
    targetFederationId: participants.map((p) => p.federationId).join('+'),
    requiresApproval,
    evidenceRequired: true,
    escalationPath,
    diagnostics: {
      participantCount: participants.length,
      allHavePublication,
      anyRestricted,
      anyOversight,
      governanceMode: 'shadow',
    },
  };
}

// ── Escalation transfer ───────────────────────────────────────────────────────

/**
 * Model an escalation transfer from a source unit to a target tier.
 */
export function modelEscalationTransfer(
  source: SovereignGovernanceContract,
  targetTier: SovereigntyTier,
  reason: string,
): FederationCoordinationEvent {
  const escalationPath: SovereigntyTier[] = [source.sovereigntyTier, targetTier];

  return {
    eventId: nextEventId(),
    eventType: 'escalation-transfer',
    sourceFederationId: source.federationId,
    targetFederationId: `federation.${targetTier}`,
    requiresApproval: true,
    evidenceRequired: true,
    escalationPath,
    diagnostics: {
      reason,
      sourceMode: source.sovereigntyMode,
      governanceMode: 'shadow',
    },
  };
}

// ── Coalition governance ──────────────────────────────────────────────────────

/**
 * Model a coalition governance coordination event across multiple federation
 * units that are not in a strict parent-child relationship.
 */
export function modelCoalitionGovernance(
  participants: SovereignGovernanceContract[],
  eventType: CoordinationEventType = 'coalition-governance',
): FederationCoordinationEvent {
  if (participants.length < 2) {
    throw new Error('Coalition governance requires at least 2 participants.');
  }

  const anyRestricted = participants.some(
    (p) =>
      p.sovereigntyMode === 'restricted' ||
      p.sovereigntyMode === 'oversight-required',
  );

  const tierOrder: SovereigntyTier[] = ['national', 'regional', 'local', 'affiliate', 'coalition'];
  const highestTier = participants
    .map((p) => p.sovereigntyTier)
    .sort((a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b))[0] ?? 'national';

  return {
    eventId: nextEventId(),
    eventType,
    sourceFederationId: participants.map((p) => p.federationId).join('+'),
    targetFederationId: `coalition.${highestTier}`,
    requiresApproval: anyRestricted,
    evidenceRequired: anyRestricted,
    escalationPath: anyRestricted ? [highestTier, 'national'] : [highestTier],
    diagnostics: {
      participantCount: participants.length,
      highestTier,
      anyRestricted,
      governanceMode: 'shadow',
    },
  };
}

// ── Continuity resilience snapshot ───────────────────────────────────────────

/**
 * Produce a shadow-mode continuity resilience snapshot across a set of
 * federation contracts, respecting audit visibility sovereignty.
 *
 * National sees aggregate degradation trends, never local operational detail.
 */
export function snapshotContinuityResilience(
  contracts: SovereignGovernanceContract[],
): ContinuityResilienceScore {
  let sharingAgreementsActive = 0;
  let continuityGapsDetected = 0;

  for (const contract of contracts) {
    const hasAuthority = contract.delegatedAuthorities.includes('continuity-management');
    const noRequirements = contract.continuityRequirements.length === 0;

    if (hasAuthority) sharingAgreementsActive++;
    if (!hasAuthority && !noRequirements) continuityGapsDetected++;
  }

  const jurisdictionIntact = contracts.every(
    (c) => c.sovereigntyMode !== 'restricted' || c.continuityRequirements.length > 0,
  );

  const gapPenalty = continuityGapsDetected * 12;
  const score = Math.max(0, Math.min(100, 100 - gapPenalty));

  return {
    score,
    sharingAgreementsActive,
    continuityGapsDetected,
    jurisdictionIntact,
  };
}
