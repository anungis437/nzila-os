/**
 * ARTIFACT TYPE: OCRA → Intelligence Signal Adapter (Product 5)
 * MODULE: intelligence/adapters/ocraIntelligenceSignalAdapter
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §7 + §8 (aggregate-safe)
 *
 * Emits an aggregation-safe signal envelope for Product 5 (Institutional
 * Intelligence). The intelligence layer aggregates these across many
 * institutions, so the payload must be:
 *
 *  - k-anonymous by construction (only enum tokens, no identifiers).
 *  - Stable across releases (versioned envelope).
 *  - Deterministic so re-emission produces identical payloads.
 */

import type { ContextualAssessmentResult } from '@/lib/icra/adaptation';

export const INTELLIGENCE_SIGNAL_VERSION = '1.0.0' as const;
export type IntelligenceSignalVersion = typeof INTELLIGENCE_SIGNAL_VERSION;

export interface OcraIntelligenceSignal {
  readonly signalVersion: IntelligenceSignalVersion;
  readonly doctrineVersion: '1.0.0';
  readonly profileBand: {
    readonly institutionalScale: string;
    readonly continuityComplexity: string;
    readonly governanceComplexity: string;
    readonly continuityExposure: string;
    readonly respondentLens: string;
  };
  /** Severity bucket only — never the raw composite. */
  readonly severityBucket: string;
  /** Top three emphasized dimensions (or fewer if not enough emphasis). */
  readonly topDimensions: readonly string[];
  /** Rule ids that fired during adaptation. */
  readonly firedRuleIds: readonly string[];
  /** Whether routing fell back to the safe-default full bank. */
  readonly routingFellBack: boolean;
}

export function buildIntelligenceSignal(
  result: ContextualAssessmentResult,
  routingFellBack: boolean,
): OcraIntelligenceSignal {
  const profile = result.institutionalProfile;
  const top = [...result.contextualEmphasis]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((e) => e.dimension);

  const ruleIds = result.adaptationRationale.map((r) => r.ruleId).sort();

  return Object.freeze({
    signalVersion: INTELLIGENCE_SIGNAL_VERSION,
    doctrineVersion: '1.0.0' as const,
    profileBand: Object.freeze({
      institutionalScale: profile.institutionalScale,
      continuityComplexity: profile.continuityComplexity,
      governanceComplexity: profile.governanceComplexity,
      continuityExposure: profile.continuityExposure,
      respondentLens: profile.respondentLens,
    }),
    severityBucket: result.normalizedInterpretation.severity,
    topDimensions: Object.freeze(top),
    firedRuleIds: Object.freeze(ruleIds),
    routingFellBack,
  });
}
