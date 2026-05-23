/**
 * ARTIFACT TYPE: Adaptive Scoring Wrapper (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5; OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md §5
 *
 * Wraps an unchanged `InstitutionalContinuityProfile` (the raw scoring
 * output) with profile-aware emphasis, normalized interpretation, and
 * scale-adjusted warnings. The raw object is preserved verbatim.
 */

import type {
  ContinuityObservation,
  InstitutionalContinuityProfile,
} from '../types';
import {
  normalizeContextualScore,
  type NormalizedInterpretation,
} from './contextualScoreNormalizer';
import {
  resolveDomainEmphasis,
  type DomainEmphasis,
} from './domainWeightingModel';
import type { InstitutionalAssessmentProfile } from './types';

export interface AdaptationRationale {
  readonly area: 'emphasis' | 'interpretation' | 'warning_filter';
  readonly ruleId: string;
  readonly statement: string;
}

/**
 * Scale-adjusted warning. Mirrors the existing `ContinuityObservation`
 * shape so downstream surfaces can render either kind.
 */
export type ScaleAdjustedWarning = ContinuityObservation;

export interface ContextualAssessmentResult {
  /** Unmodified raw scoring output — never mutated. */
  readonly rawProfile: InstitutionalContinuityProfile;
  /** Organizational profile that drove the adaptation. */
  readonly institutionalProfile: InstitutionalAssessmentProfile;
  /** Per-dimension narrative emphasis. */
  readonly contextualEmphasis: readonly DomainEmphasis[];
  /** Profile-aware label for the raw composite. */
  readonly normalizedInterpretation: NormalizedInterpretation;
  /** Observations that survived scale-appropriateness filtering. */
  readonly scaleAdjustedWarnings: readonly ScaleAdjustedWarning[];
  /** Audit-grade rationale entries — one per non-trivial adaptive decision. */
  readonly adaptationRationale: readonly AdaptationRationale[];
}

// ── Scale-appropriateness filter ──────────────────────────────────────────

/**
 * Observation ids or category/statement signatures that should be suppressed
 * for very small organizations because they imply infrastructure those
 * institutions don't have.
 *
 * We match by id when available and by a substring of `statement` as fallback
 * (defensive — observation ids are not stable across bank versions).
 */
const SMALL_ORG_SUPPRESSED_SIGNALS = [
  'multi_region',
  'multi-site runtime',
  'enterprise observability',
  'distributed runtime governance',
];

function isSuppressedForSmallScale(o: ContinuityObservation): boolean {
  const haystack = `${o.id} ${o.statement}`.toLowerCase();
  return SMALL_ORG_SUPPRESSED_SIGNALS.some((needle) => haystack.includes(needle));
}

function filterWarningsForProfile(
  observations: readonly ContinuityObservation[],
  profile: InstitutionalAssessmentProfile,
): { kept: ContinuityObservation[]; suppressedCount: number } {
  if (profile.institutionalScale !== 'micro' && profile.institutionalScale !== 'small') {
    return { kept: [...observations], suppressedCount: 0 };
  }
  let suppressed = 0;
  const kept = observations.filter((o) => {
    if (isSuppressedForSmallScale(o)) {
      suppressed += 1;
      return false;
    }
    return true;
  });
  return { kept, suppressedCount: suppressed };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Produce a `ContextualAssessmentResult` from a raw scoring profile and an
 * organizational profile. Deterministic. The raw profile is included by
 * reference and never mutated.
 */
export function adaptScoring(
  rawProfile: InstitutionalContinuityProfile,
  institutionalProfile: InstitutionalAssessmentProfile,
): ContextualAssessmentResult {
  const emphasis = resolveDomainEmphasis(institutionalProfile);
  const interpretation = normalizeContextualScore(
    rawProfile.composite,
    institutionalProfile,
  );
  const { kept, suppressedCount } = filterWarningsForProfile(
    rawProfile.observations,
    institutionalProfile,
  );

  const rationale: AdaptationRationale[] = [];

  // Emphasis rationale: report one entry per dimension whose weight differs
  // from the parity default of 0.5.
  for (const e of emphasis) {
    if (e.weight !== 0.5) {
      rationale.push({
        area: 'emphasis',
        ruleId: `emphasis.${e.dimension}_adjusted`,
        statement: e.rationale,
      });
    }
  }

  rationale.push({
    area: 'interpretation',
    ruleId: interpretation.ruleId,
    statement: `Raw composite ${interpretation.rawComposite} maps to severity "${interpretation.severity}" under ${institutionalProfile.continuityExposure} exposure bands.`,
  });

  if (suppressedCount > 0) {
    rationale.push({
      area: 'warning_filter',
      ruleId: 'warning_filter.small_scale_suppression',
      statement: `${suppressedCount} observation(s) referencing infrastructure inappropriate for ${institutionalProfile.institutionalScale}-scale institutions were filtered.`,
    });
  }

  return Object.freeze({
    rawProfile,
    institutionalProfile,
    contextualEmphasis: emphasis,
    normalizedInterpretation: interpretation,
    scaleAdjustedWarnings: Object.freeze(kept),
    adaptationRationale: Object.freeze(rationale),
  });
}
