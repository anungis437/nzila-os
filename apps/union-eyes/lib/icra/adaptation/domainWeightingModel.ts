/**
 * ARTIFACT TYPE: Domain Weighting Model (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5; OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md §5
 *
 * Produces narrative-emphasis weights per dimension based on the profile.
 *
 * Critical: this DOES NOT alter raw scores. The raw `composite` and
 * per-dimension `score` values remain untouched. Emphasis only governs
 * which dimensions the narrative engine leans into (e.g., a hospital's
 * report leans harder into runtime continuity; a small union's leans into
 * stewardship distribution).
 */

import type { DimensionId } from '../types';
import type { InstitutionalAssessmentProfile } from './types';

/**
 * Per-dimension emphasis weight ∈ [0, 1]. Sum across dimensions has no
 * required total; emphasis is RELATIVE within a single profile and used
 * by the narrative engine to prioritize, not to score.
 */
export interface DomainEmphasis {
  readonly dimension: DimensionId;
  readonly weight: number;
  readonly rationale: string;
}

/** Default emphasis: every dimension at parity. */
const PARITY: ReadonlyArray<DomainEmphasis> = [
  { dimension: 'institutional_continuity', weight: 0.5, rationale: 'Default parity emphasis.' },
  { dimension: 'governance_fragility', weight: 0.5, rationale: 'Default parity emphasis.' },
  { dimension: 'trust_debt', weight: 0.5, rationale: 'Default parity emphasis.' },
  { dimension: 'operational_memory', weight: 0.5, rationale: 'Default parity emphasis.' },
  { dimension: 'transition_readiness', weight: 0.5, rationale: 'Default parity emphasis.' },
];

function bump(
  base: ReadonlyArray<DomainEmphasis>,
  dimension: DimensionId,
  delta: number,
  rationale: string,
): DomainEmphasis[] {
  return base.map((d) =>
    d.dimension === dimension
      ? {
          dimension,
          weight: Math.min(1, Math.max(0, d.weight + delta)),
          rationale,
        }
      : { ...d },
  );
}

/**
 * Resolve per-dimension emphasis for a profile. Deterministic.
 */
export function resolveDomainEmphasis(
  profile: InstitutionalAssessmentProfile,
): readonly DomainEmphasis[] {
  let out: DomainEmphasis[] = PARITY.map((d) => ({ ...d }));

  // Scale-driven emphasis.
  if (profile.institutionalScale === 'micro' || profile.institutionalScale === 'small') {
    out = bump(out, 'trust_debt', 0.2, 'Small institutions concentrate continuity in trusted individuals; trust_debt is emphasized.');
    out = bump(out, 'institutional_continuity', 0.1, 'Small institutions read continuity through stewardship survival.');
  }
  if (profile.institutionalScale === 'federated_complex') {
    out = bump(out, 'governance_fragility', 0.3, 'Federated complexity amplifies governance-fragility interpretation across affiliated units.');
    out = bump(out, 'operational_memory', 0.2, 'Federations face uneven institutional memory across units.');
  }
  if (profile.institutionalScale === 'large' || profile.institutionalScale === 'enterprise') {
    out = bump(out, 'operational_memory', 0.2, 'Large institutions face memory-loss risk from scale and turnover.');
    out = bump(out, 'transition_readiness', 0.1, 'Large institutions face higher-stakes transitions.');
  }

  // Exposure-driven emphasis.
  if (profile.continuityExposure === 'mission_critical') {
    out = bump(out, 'institutional_continuity', 0.3, 'Mission-critical exposure prioritizes baseline continuity above all.');
    out = bump(out, 'transition_readiness', 0.2, 'Mission-critical operations cannot tolerate transition gaps.');
  }
  if (profile.continuityExposure === 'public_trust') {
    out = bump(out, 'trust_debt', 0.2, 'Public-trust institutions carry external trust obligations.');
    out = bump(out, 'governance_fragility', 0.1, 'Public accountability increases governance-fragility weight.');
  }

  // Governance-driven emphasis.
  if (profile.governanceComplexity === 'public_accountability') {
    out = bump(out, 'governance_fragility', 0.1, 'Public accountability emphasizes governance fragility.');
  }
  if (profile.governanceComplexity === 'federated') {
    out = bump(out, 'governance_fragility', 0.1, 'Federated governance compounds governance-fragility interpretation.');
  }

  return Object.freeze(out);
}
