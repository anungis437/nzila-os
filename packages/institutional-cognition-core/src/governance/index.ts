/**
 * Cognition Governance
 *
 * Runtime guardrails that enforce labor-safe, organizationally-scoped
 * cognition. These are NOT optional. Every engine and orchestration step
 * must pass through these gates.
 *
 * Forbidden cognition modes:
 *   - Workforce surveillance
 *   - Individual employee scoring / ranking / monitoring
 *   - Predictive discipline / retention targeting
 *   - Personality / sentiment profiling of identified individuals
 *   - Any analysis whose unit-of-observation is a single person
 *
 * Allowed cognition modes:
 *   - Organizational, departmental, role-cohort, process-level analysis
 *   - Institutional learning, governance reasoning, continuity forecasting
 *   - Aggregated, anonymized signals about systemic dynamics
 */

import type { CognitionDomain } from '../ontology/index';

export class CognitionGovernanceViolation extends Error {
  readonly code: string;
  readonly domain: CognitionDomain | 'cross_domain';
  constructor(
    code: string,
    message: string,
    domain: CognitionDomain | 'cross_domain' = 'cross_domain',
  ) {
    super(message);
    this.name = 'CognitionGovernanceViolation';
    this.code = code;
    this.domain = domain;
  }
}

export interface CognitionGovernanceContext {
  organizationId: string;
  domain: CognitionDomain;
  /** Indicates whether the engine intends to access individual-level data. */
  scopeOfObservation: 'organizational' | 'departmental' | 'role_cohort' | 'process' | 'individual';
  /** True if the engine performs ranking/scoring of individuals. */
  ranksIndividuals?: boolean;
  /** True if the engine generates retention or discipline predictions. */
  predictsDisciplineOrRetention?: boolean;
  /** True if the engine relies on sentiment/personality of identified people. */
  usesIdentifiedSentiment?: boolean;
}

/**
 * Asserts a cognition operation is labor-safe. Throws if not.
 * MUST be invoked at the top of every cognition engine entrypoint.
 */
export function assertLaborSafe(ctx: CognitionGovernanceContext): void {
  if (!ctx.organizationId || ctx.organizationId.trim() === '') {
    throw new CognitionGovernanceViolation(
      'org_scope_missing',
      'Cognition operations require an organizationId.',
      ctx.domain,
    );
  }
  if (ctx.scopeOfObservation === 'individual') {
    throw new CognitionGovernanceViolation(
      'individual_scope_forbidden',
      `Cognition domain "${ctx.domain}" attempted individual-level observation. ` +
        'Institutional cognition operates at organizational/departmental/role-cohort/process scope only.',
      ctx.domain,
    );
  }
  if (ctx.ranksIndividuals) {
    throw new CognitionGovernanceViolation(
      'individual_ranking_forbidden',
      `Cognition domain "${ctx.domain}" attempted to rank individuals. Forbidden under labor-safe posture.`,
      ctx.domain,
    );
  }
  if (ctx.predictsDisciplineOrRetention) {
    throw new CognitionGovernanceViolation(
      'predictive_discipline_forbidden',
      `Cognition domain "${ctx.domain}" attempted predictive discipline/retention modeling. Forbidden.`,
      ctx.domain,
    );
  }
  if (ctx.usesIdentifiedSentiment) {
    throw new CognitionGovernanceViolation(
      'identified_sentiment_forbidden',
      `Cognition domain "${ctx.domain}" attempted identified-individual sentiment analysis. Forbidden.`,
      ctx.domain,
    );
  }
}

/**
 * Helper for read-only checks (returns a violation rather than throwing).
 */
export function checkLaborSafe(ctx: CognitionGovernanceContext): CognitionGovernanceViolation | null {
  try {
    assertLaborSafe(ctx);
    return null;
  } catch (err) {
    return err instanceof CognitionGovernanceViolation ? err : null;
  }
}
