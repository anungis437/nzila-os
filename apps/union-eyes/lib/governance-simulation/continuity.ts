/**
 * Institutional continuity stress engine.
 *
 * Simulates governance chain disruptions caused by:
 *   - Leadership turnover (steward, executive role vacated)
 *   - Governance orphaning (policy contract without owner)
 *   - Audit chain loss (required events missing)
 *   - Policy ownership gaps
 *
 * Read-only; shadow-mode only. Never mutates production state.
 *
 * @module lib/governance-simulation/continuity
 */

import type {
  GovernanceSimulationScenario,
  ContinuitySimulationResult,
  InstitutionalStressType,
} from './types';

// ── Remediation step catalog ──────────────────────────────────────────────────

const REMEDIATION_STEPS: Record<InstitutionalStressType, string[]> = {
  'leadership-turnover': [
    'Activate interim designation protocol.',
    'Transfer active governance obligations to deputy.',
    'Notify federation of leadership continuity event.',
    'Suspend pending approvals pending authority re-establishment.',
  ],
  'continuity-loss': [
    'Reconstruct governance chain from audit ledger.',
    'Identify policy orphans and assign emergency ownership.',
    'File legal-hold on all affected evidence.',
    'Notify executive governance committee.',
  ],
  'federation-conflict': [
    'Pause local operations conflicting with federation policy.',
    'Initiate federation arbitration procedure.',
    'Retain all evidence from conflict period.',
  ],
  'policy-divergence': [
    'Flag divergent policy for federation review.',
    'Suspend local publication rights during review.',
    'Document divergence in governance ledger.',
  ],
  'publication-escalation': [
    'Block publication pending executive approval.',
    'Route approval request to designated executive authority.',
    'Record escalation in governance evidence ledger.',
  ],
  'ai-governance-risk': [
    'Suspend AI operation pending human review.',
    'Classify operation with elevated risk tier.',
    'Document AI action trace for audit record.',
  ],
  'member-trust-event': [
    'Activate member communications governance protocol.',
    'Retain all member-facing evidence.',
    'Notify governance committee of trust event.',
    'Engage legal review for affected member records.',
  ],
};

function getRemediationSteps(stressType: InstitutionalStressType): string[] {
  return REMEDIATION_STEPS[stressType] ?? [
    'Activate emergency governance protocol.',
    'Notify institutional governance authority.',
  ];
}

// ── Gap detection ─────────────────────────────────────────────────────────────

function detectLeadershipGap(scenario: GovernanceSimulationScenario): boolean {
  return (
    scenario.stressType === 'leadership-turnover' &&
    (scenario.governanceSensitivity === 'high' ||
      scenario.governanceSensitivity === 'critical')
  );
}

function detectAuditChainBreak(scenario: GovernanceSimulationScenario): boolean {
  if (scenario.incidentClass === 'audit-gap') return true;
  if (scenario.stressType === 'continuity-loss') return true;
  return false;
}

function detectGovernanceOrphan(scenario: GovernanceSimulationScenario): boolean {
  return (
    scenario.stressType === 'continuity-loss' &&
    scenario.incidentClass !== 'audit-gap'
  );
}

function detectPolicyOwnershipGap(scenario: GovernanceSimulationScenario): boolean {
  return (
    scenario.stressType === 'continuity-loss' ||
    scenario.stressType === 'policy-divergence'
  );
}

function inferAffectedRoles(scenario: GovernanceSimulationScenario): string[] {
  const roles: string[] = [];
  switch (scenario.stressType) {
    case 'leadership-turnover':
      roles.push('steward', 'executive');
      if (scenario.governanceSensitivity === 'critical') {
        roles.push('governance-committee');
      }
      break;
    case 'continuity-loss':
      roles.push('governance-owner', 'policy-custodian');
      break;
    case 'policy-divergence':
      roles.push('governance-officer');
      break;
    default:
      roles.push('governance-authority');
  }
  return roles;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simulate a continuity stress scenario.
 *
 * Returns a `ContinuitySimulationResult` describing detected gaps,
 * affected roles, and remediation steps required.
 *
 * Never throws; errors are captured in `diagnostics`.
 */
export function simulateContinuityStress(
  scenario: GovernanceSimulationScenario,
): ContinuitySimulationResult {
  try {
    const leadershipGap = detectLeadershipGap(scenario);
    const auditChainIntact = !detectAuditChainBreak(scenario);
    const governanceOrphanDetected = detectGovernanceOrphan(scenario);
    const policyOwnershipGap = detectPolicyOwnershipGap(scenario);

    const continuityGapDetected =
      leadershipGap || !auditChainIntact || governanceOrphanDetected || policyOwnershipGap;

    const escalationRequired =
      continuityGapDetected &&
      (scenario.escalationExpected ||
        scenario.governanceSensitivity === 'critical' ||
        scenario.governanceSensitivity === 'high');

    const affectedRoles = inferAffectedRoles(scenario);
    const remediationSteps = getRemediationSteps(
      scenario.stressType ?? 'continuity-loss',
    );

    return {
      scenarioId: scenario.id,
      stressType: scenario.stressType ?? 'continuity-loss',
      continuityGapDetected,
      governanceOrphanDetected,
      auditChainIntact,
      leadershipGap,
      policyOwnershipGap,
      escalationRequired,
      affectedRoles,
      remediationSteps,
      diagnostics: {
        scope: scenario.scope,
        sensitivity: scenario.governanceSensitivity,
        governanceMode: 'shadow' as const,
        assumptions: scenario.assumptions,
      },
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      stressType: scenario.stressType ?? 'continuity-loss',
      continuityGapDetected: false,
      governanceOrphanDetected: false,
      auditChainIntact: true,
      leadershipGap: false,
      policyOwnershipGap: false,
      escalationRequired: false,
      affectedRoles: [],
      remediationSteps: [],
      diagnostics: { error: String(err), governanceMode: 'shadow' as const },
    };
  }
}
