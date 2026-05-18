/**
 * Governance simulation scenario catalog.
 *
 * Defines reusable, deterministic scenario contracts covering the
 * principal institutional governance stress cases for Union Eyes:
 *
 *   - Federation conflict paths
 *   - Continuity stress
 *   - Publication escalation
 *   - AI governance risk
 *   - Incident simulation
 *
 * Scenarios are pure data — no I/O, no side effects.
 * The simulation engine in simulation.ts executes them.
 *
 * @module lib/governance-simulation/scenarios
 */

import type { GovernanceSimulationScenario } from './types';

// ── Built-in scenario catalog ─────────────────────────────────────────────────

/**
 * Platform-wide scenario catalog.
 * Consumers can extend this with org-specific scenarios via
 * `registerScenario()`.
 */
// ga-check:exempt — in-process scenario catalog, not primary persistence
const _catalog: Map<string, GovernanceSimulationScenario> = new Map();

// ── Scenario registration ─────────────────────────────────────────────────────

export function registerScenario(scenario: GovernanceSimulationScenario): void {
  _catalog.set(scenario.id, scenario);
}

export function getScenario(id: string): GovernanceSimulationScenario | undefined {
  return _catalog.get(id);
}

export function getAllScenarios(): GovernanceSimulationScenario[] {
  return Array.from(_catalog.values());
}

export function getScenariosByScope(
  scope: GovernanceSimulationScenario['scope'],
): GovernanceSimulationScenario[] {
  return getAllScenarios().filter((s) => s.scope === scope);
}

/** Reset catalog — for tests only. */
export function _resetScenarioCatalog(): void {
  _catalog.clear();
  _bootstrapBuiltinScenarios();
}

// ── Built-in scenarios ────────────────────────────────────────────────────────

function _bootstrapBuiltinScenarios(): void {
  // ── Federation conflict scenarios ──────────────────────────────────────────

  registerScenario({
    id: 'federation.policy-tightening-cascade',
    description: 'National tightens a governance policy; regional inherits; local publication request conflicts.',
    scope: 'federation',
    stressType: 'federation-conflict',
    federationTier: 'local',
    governanceSensitivity: 'high',
    assumptions: [
      'National policy update is valid and published.',
      'Regional inheritance chain is intact.',
      'Local publication was submitted before national update.',
    ],
    simulatedPolicies: ['route.governed', 'public-experience.federation'],
    expectedOutcomes: [
      'inheritance.cascade.triggered',
      'local.publication.blocked',
      'escalation.triggered',
      'federation-review.required',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  registerScenario({
    id: 'federation.local-weakening-attempt',
    description: 'Local org attempts to weaken an inherited federation policy. Governance engine must reject.',
    scope: 'federation',
    stressType: 'policy-divergence',
    federationTier: 'local',
    governanceSensitivity: 'critical',
    assumptions: [
      'Local org is not granted override authority.',
      'Federation baseline policy has no delegation clause.',
    ],
    simulatedPolicies: ['route.governed'],
    expectedOutcomes: [
      'override.rejected',
      'audit.emitted',
      'federation.conflict.recorded',
    ],
    evidenceRequired: true,
    escalationExpected: false,
    incidentClass: 'federation-policy-divergence',
  });

  registerScenario({
    id: 'federation.governance-deadlock',
    description: 'Regional and national governance units disagree on policy resolution. Deadlock path simulated.',
    scope: 'federation',
    stressType: 'federation-conflict',
    federationTier: 'regional',
    governanceSensitivity: 'critical',
    assumptions: [
      'Both parties have submitted conflicting policy interpretations.',
      'No higher arbitration tier is available.',
    ],
    simulatedPolicies: ['route.governed', 'public-experience.federation'],
    expectedOutcomes: [
      'escalation.triggered',
      'governance.deadlock.detected',
      'executive-approval.required',
      'publication.blocked',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  // ── Continuity stress scenarios ────────────────────────────────────────────

  registerScenario({
    id: 'continuity.steward-turnover',
    description: 'Primary steward role vacated. Governance chain continuity assessed across all active operations.',
    scope: 'continuity',
    stressType: 'leadership-turnover',
    governanceSensitivity: 'high',
    assumptions: [
      'Steward role has active governance responsibilities.',
      'No interim designation has been made.',
    ],
    simulatedPolicies: ['route.governed'],
    expectedOutcomes: [
      'continuity.gap.detected',
      'governance.orphan.identified',
      'succession.alert.generated',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  registerScenario({
    id: 'continuity.executive-turnover',
    description: 'Executive officer role vacated mid-governance-cycle. Approval authority gap assessed.',
    scope: 'continuity',
    stressType: 'leadership-turnover',
    governanceSensitivity: 'critical',
    assumptions: [
      'Executive has outstanding approval obligations.',
      'Deputy authority is not yet activated.',
    ],
    simulatedPolicies: ['route.governed', 'public-experience.federation'],
    expectedOutcomes: [
      'continuity.gap.detected',
      'approval.authority.gap',
      'publication.blocked',
      'escalation.triggered',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  registerScenario({
    id: 'continuity.audit-chain-loss',
    description: 'Required audit events missing from governance chain. Gap impact simulated.',
    scope: 'continuity',
    stressType: 'continuity-loss',
    governanceSensitivity: 'critical',
    assumptions: [
      'Audit events are expected for all governed operations.',
      'At least one required event is missing.',
    ],
    simulatedPolicies: ['route.governed'],
    expectedOutcomes: [
      'audit.gap.detected',
      'governance.chain.incomplete',
      'legal-review.required',
    ],
    evidenceRequired: true,
    escalationExpected: true,
    incidentClass: 'audit-gap',
  });

  registerScenario({
    id: 'continuity.governance-orphan',
    description: 'Governance ownership of a policy contract becomes undefined. Orphan resolution path simulated.',
    scope: 'continuity',
    stressType: 'continuity-loss',
    governanceSensitivity: 'high',
    assumptions: [
      'Policy contract owner has been removed from the org.',
      'No ownership transfer has been recorded.',
    ],
    simulatedPolicies: ['route.governed'],
    expectedOutcomes: [
      'continuity.gap.detected',
      'policy.orphan.detected',
      'governance.escalation.triggered',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  // ── Publication escalation scenarios ───────────────────────────────────────

  registerScenario({
    id: 'publication.unauthorized-attempt',
    description: 'Publication submitted without required executive approval. Governance engine must block.',
    scope: 'publication',
    stressType: 'publication-escalation',
    governanceSensitivity: 'high',
    assumptions: [
      'Publication target requires executive-approval.',
      'Submitter does not hold executive role.',
    ],
    simulatedPolicies: ['public-experience.surface'],
    expectedOutcomes: [
      'publication.blocked',
      'approval.required',
      'audit.emitted',
    ],
    evidenceRequired: true,
    escalationExpected: true,
    incidentClass: 'unauthorized-publication',
  });

  registerScenario({
    id: 'publication.federation-dispute',
    description: 'Local org publishes content conflicting with federation publication restrictions.',
    scope: 'publication',
    stressType: 'publication-escalation',
    federationTier: 'local',
    governanceSensitivity: 'critical',
    assumptions: [
      'Federation has active publication restriction policy.',
      'Local content has not been reviewed by federation.',
    ],
    simulatedPolicies: ['public-experience.federation'],
    expectedOutcomes: [
      'publication.blocked',
      'federation-review.required',
      'federation.conflict.recorded',
      'escalation.triggered',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  // ── AI governance scenarios ────────────────────────────────────────────────

  registerScenario({
    id: 'ai.restricted-operation-escalation',
    description: 'AI action classified as restricted triggers mandatory human review path.',
    scope: 'ai-operation',
    stressType: 'ai-governance-risk',
    governanceSensitivity: 'critical',
    assumptions: [
      'AI action is classified as restricted risk.',
      'Human review workflow is active.',
    ],
    simulatedPolicies: ['ai-operation.sensitive'],
    expectedOutcomes: [
      'human-review.triggered',
      'ai-operation.escalated',
      'audit.emitted',
    ],
    evidenceRequired: true,
    escalationExpected: true,
  });

  registerScenario({
    id: 'ai.advisory-to-restricted-transition',
    description: 'AI action initially classified advisory is re-classified restricted during execution. Governance path adapts.',
    scope: 'ai-operation',
    stressType: 'ai-governance-risk',
    governanceSensitivity: 'high',
    assumptions: [
      'AI action begins as advisory.',
      'Mid-execution context causes risk tier elevation.',
    ],
    simulatedPolicies: ['ai-operation.assistive', 'ai-operation.sensitive'],
    expectedOutcomes: [
      'risk.reclassified',
      'human-review.triggered',
      'escalation.triggered',
    ],
    evidenceRequired: true,
    escalationExpected: true,
    incidentClass: 'ai-escalation-failure',
  });

  registerScenario({
    id: 'ai.federation-restriction',
    description: 'AI operation permitted at local tier is restricted at federation level.',
    scope: 'ai-operation',
    stressType: 'federation-conflict',
    federationTier: 'local',
    governanceSensitivity: 'high',
    assumptions: [
      'Federation has published an AI restriction policy.',
      'Local org has not yet received the restriction update.',
    ],
    simulatedPolicies: ['ai-operation.sensitive', 'public-experience.federation'],
    expectedOutcomes: [
      'ai-operation.blocked',
      'federation.restriction.applied',
      'audit.emitted',
    ],
    evidenceRequired: true,
    escalationExpected: false,
  });

  // ── Incident scenarios ─────────────────────────────────────────────────────

  registerScenario({
    id: 'incident.policy-breach',
    description: 'Governance operation executed outside declared policy boundary. Impact simulated.',
    scope: 'incident',
    governanceSensitivity: 'critical',
    assumptions: [
      'Policy boundary is defined and enforced in shadow mode.',
      'Operation proceeded without required approval.',
    ],
    simulatedPolicies: ['route.governed'],
    expectedOutcomes: [
      'policy.breach.detected',
      'audit.emitted',
      'legal-review.required',
      'escalation.triggered',
    ],
    evidenceRequired: true,
    escalationExpected: true,
    incidentClass: 'policy-breach',
  });
}

// Bootstrap on module load
_bootstrapBuiltinScenarios();
