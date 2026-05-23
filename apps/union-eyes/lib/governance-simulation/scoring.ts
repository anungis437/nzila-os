/**
 * Organizational readiness scoring engine.
 *
 * Aggregates simulation ledger data into dimensional readiness scores.
 * Shadow-mode only — scores are never exposed publicly in Wave 9.
 *
 * Scores are 0–100 per dimension and do not represent certifications.
 * They are organizational maturity telemetry for internal governance planning.
 *
 * @module lib/governance-simulation/scoring
 */

import type {
  InstitutionalReadinessScore,
  GovernanceContinuityScore,
  FederationStabilityScore,
  PublicationGovernanceScore,
  AIAccountabilityScore,
  GovernanceSimulationResult,
} from './types';
import { peekSimulationLedger } from './ledger';

// ── Scoring helpers ───────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function outcomeMatchPenalty(result: GovernanceSimulationResult): number {
  return result.outcomesMatched ? 0 : result.unmatchedExpected.length * 5;
}

// ── Dimension scoring ─────────────────────────────────────────────────────────

function scoreContinuity(
  results: GovernanceSimulationResult[],
): GovernanceContinuityScore {
  const continuityResults = results.filter((r) => r.continuityGapDetected || r.diagnostics['scope'] === 'continuity');

  let score = 100;
  let continuityGapsDetected = 0;
  let leadershipVulnerabilities = 0;
  let auditChainIntegrity = true;

  for (const r of continuityResults) {
    if (r.continuityGapDetected) {
      continuityGapsDetected++;
      score -= 10;
    }
    if (
      r.actualOutcomes.includes('governance.orphan.identified') ||
      r.actualOutcomes.includes('succession.alert.generated')
    ) {
      leadershipVulnerabilities++;
      score -= 8;
    }
    if (
      r.actualOutcomes.includes('audit.gap.detected') ||
      r.actualOutcomes.includes('governance.chain.incomplete')
    ) {
      auditChainIntegrity = false;
      score -= 15;
    }
    score -= outcomeMatchPenalty(r);
  }

  return {
    score: clamp(score),
    continuityGapsDetected,
    leadershipVulnerabilities,
    auditChainIntegrity,
  };
}

function scoreFederationStability(
  results: GovernanceSimulationResult[],
): FederationStabilityScore {
  const fedResults = results.filter((r) => r.federationConflictDetected || r.diagnostics['scope'] === 'federation');

  let score = 100;
  let conflictsSimulated = 0;
  let conflictsResolved = 0;
  let inheritanceViolations = 0;

  for (const r of fedResults) {
    if (r.federationConflictDetected) {
      conflictsSimulated++;
      score -= 8;

      // "resolved" = escalation chain was triggered (governance responded)
      if (r.escalationChain.length > 0) {
        conflictsResolved++;
        score += 3; // partial credit for governance response
      }
    }
    if (
      r.actualOutcomes.includes('override.rejected') ||
      r.actualOutcomes.includes('federation.conflict.recorded')
    ) {
      inheritanceViolations++;
      score -= 5;
    }
    if (r.actualOutcomes.includes('governance.deadlock.detected')) {
      score -= 12;
    }
    score -= outcomeMatchPenalty(r);
  }

  return {
    score: clamp(score),
    conflictsSimulated,
    conflictsResolved,
    inheritanceViolations,
  };
}

function scorePublicationGovernance(
  results: GovernanceSimulationResult[],
): PublicationGovernanceScore {
  const pubResults = results.filter((r) =>
    r.diagnostics['scope'] === 'publication' ||
    r.actualOutcomes.includes('publication.blocked') ||
    r.actualOutcomes.includes('unauthorized-publication'),
  );

  let score = 100;
  let escalationsRequired = 0;
  let unauthorizedAttempts = 0;
  let approvalCoverageComplete = true;

  for (const r of pubResults) {
    if (r.escalationChain.length > 0) {
      escalationsRequired++;
      score -= 5;
    }
    if (r.actualOutcomes.includes('publication.blocked')) {
      // Blocked publications mean governance is working, only minor penalty
      score -= 3;
    }
    if (r.diagnostics['incidentClass'] === 'unauthorized-publication' ||
        r.actualOutcomes.includes('unauthorized-publication')) {
      unauthorizedAttempts++;
      score -= 15;
      approvalCoverageComplete = false;
    }
    score -= outcomeMatchPenalty(r);
  }

  return {
    score: clamp(score),
    escalationsRequired,
    unauthorizedAttempts,
    approvalCoverageComplete,
  };
}

function scoreAIAccountability(
  results: GovernanceSimulationResult[],
): AIAccountabilityScore {
  const aiResults = results.filter((r) =>
    r.diagnostics['scope'] === 'ai-operation' ||
    r.actualOutcomes.includes('human-review.triggered') ||
    r.actualOutcomes.includes('ai-operation.escalated'),
  );

  let score = 100;
  let highRiskOperationsSimulated = 0;
  let humanReviewTriggered = 0;
  let escalationsResolved = 0;

  for (const r of aiResults) {
    if (
      r.actualOutcomes.includes('ai-operation.escalated') ||
      r.actualOutcomes.includes('human-review.triggered')
    ) {
      highRiskOperationsSimulated++;
      humanReviewTriggered++;
      // Human review triggered = governance is functioning
      score += 2; // slight credit
    }
    if (r.escalationChain.length > 0) {
      escalationsResolved++;
    }
    if (r.actualOutcomes.includes('ai-operation.blocked')) {
      // Blocked ops indicate governance enforcement working
      score -= 2;
    }
    if (r.diagnostics['incidentClass'] === 'ai-escalation-failure') {
      score -= 10;
    }
    score -= outcomeMatchPenalty(r);
  }

  return {
    score: clamp(score),
    highRiskOperationsSimulated,
    humanReviewTriggered,
    escalationsResolved,
  };
}

// ── Composite scoring ─────────────────────────────────────────────────────────

function computeComposite(
  continuity: GovernanceContinuityScore,
  federation: FederationStabilityScore,
  publication: PublicationGovernanceScore,
  ai: AIAccountabilityScore,
): number {
  // Weighted composite
  const weighted =
    continuity.score * 0.35 +
    federation.score * 0.25 +
    publication.score * 0.25 +
    ai.score * 0.15;
  return clamp(Math.round(weighted));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute an `InstitutionalReadinessScore` from the current simulation ledger.
 *
 * Shadow-mode only. The result should be ledgered internally but never
 * exposed on public-facing surfaces in Wave 9.
 */
export function computeInstitutionalReadinessScore(
  ledgerSnapshot?: GovernanceSimulationResult[],
): InstitutionalReadinessScore {
  const results = ledgerSnapshot ?? [...peekSimulationLedger()];

  const continuity = scoreContinuity(results);
  const federation = scoreFederationStability(results);
  const publication = scorePublicationGovernance(results);
  const aiAccountability = scoreAIAccountability(results);
  const overall = computeComposite(continuity, federation, publication, aiAccountability);

  return {
    overall,
    continuity,
    federation,
    publication,
    aiAccountability,
    scoredAt: new Date().toISOString(),
    simulationCount: results.length,
  };
}
