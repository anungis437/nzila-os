/**
 * ARTIFACT TYPE: Adaptive Narrative Engine (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §6
 *
 * Produces a structured `AdaptiveNarrativeBundle` from a
 * `ContextualAssessmentResult` and a locale. Strings come from the
 * version-locked passage library; never interpolates respondent data;
 * never reads free text.
 */

import type { ContextualAssessmentResult } from './adaptiveScoringModel';
import {
  exposureFraming,
  governanceFraming,
  respondentCaveat,
  scaleOpener,
  type SupportedLocale,
} from './adaptivePassageLibrary';

export interface AdaptiveNarrativeBundle {
  readonly locale: SupportedLocale;
  readonly doctrineVersion: '1.0.0';
  /** Profile-aware one-sentence header (from contextual normalizer). */
  readonly headerStatement: string;
  /** Scale opener — sets institutional context. */
  readonly scaleOpener: string;
  /** Governance framing — sets oversight context. */
  readonly governanceFraming: string;
  /** Exposure framing — sets stakes context. */
  readonly exposureFraming: string;
  /** Respondent caveat — null when no caveat applies (operator/leader). */
  readonly respondentCaveat: string | null;
  /** Ordered list of (dimension, emphasis weight) for the narrative engine. */
  readonly emphasisOrder: readonly { dimension: string; weight: number }[];
  /** Stable telemetry/cache key. Never contains PII. */
  readonly bundleFingerprint: string;
}

/**
 * Build the adaptive narrative bundle. Pure, deterministic.
 */
export function buildAdaptiveNarrative(
  result: ContextualAssessmentResult,
  locale: SupportedLocale,
): AdaptiveNarrativeBundle {
  const profile = result.institutionalProfile;

  const emphasisOrder = [...result.contextualEmphasis]
    .sort((a, b) => b.weight - a.weight)
    .map((e) => ({ dimension: e.dimension, weight: e.weight }));

  const fingerprint = [
    profile.institutionalScale,
    profile.governanceComplexity,
    profile.continuityExposure,
    profile.respondentLens,
    result.normalizedInterpretation.severity,
    locale,
  ].join('|');

  return Object.freeze({
    locale,
    doctrineVersion: '1.0.0' as const,
    headerStatement: result.normalizedInterpretation.statement,
    scaleOpener: scaleOpener(profile.institutionalScale, locale),
    governanceFraming: governanceFraming(profile.governanceComplexity, locale),
    exposureFraming: exposureFraming(profile.continuityExposure, locale),
    respondentCaveat: respondentCaveat(profile.respondentLens, locale),
    emphasisOrder: Object.freeze(emphasisOrder),
    bundleFingerprint: fingerprint,
  });
}
