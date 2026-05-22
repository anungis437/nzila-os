/**
 * Longitudinal Signal Quality — Product 5 input quality model.
 *
 * Evaluates whether a signal envelope carries enough longitudinal-grade
 * evidence to be ingested into trajectory analysis. Refusal-default:
 * insufficient quality returns `eligible = false` with explicit reasons.
 *
 * No fabricated scores. No optimistic defaults.
 */

import type { AssessmentSignalEnrichment } from './assessmentSignalEnrichment';

export interface LongitudinalSignalQuality {
  eligible: boolean;
  longitudinalConfidenceSignalCount: number;
  structuralSignalCount: number;
  archetypeReadingCount: number;
  reasons: string[];
}

const MIN_LONGITUDINAL_CONFIDENCE_SIGNALS = 3;
const MIN_STRUCTURAL_SIGNALS = 2;

export function evaluateLongitudinalQuality(
  enrichment: AssessmentSignalEnrichment,
): LongitudinalSignalQuality {
  const longitudinalConfidenceSignalCount = enrichment.confidenceSignals.filter(
    (s) => s.longitudinalTracked,
  ).length;
  const structuralSignalCount = enrichment.structuralSignals.length;
  const archetypeReadingCount = enrichment.archetypeReadings.length;

  const reasons: string[] = [];
  if (longitudinalConfidenceSignalCount < MIN_LONGITUDINAL_CONFIDENCE_SIGNALS) {
    reasons.push('insufficient-longitudinal-confidence-signals');
  }
  if (structuralSignalCount < MIN_STRUCTURAL_SIGNALS) {
    reasons.push('insufficient-structural-signals');
  }
  if (archetypeReadingCount === 0) {
    reasons.push('no-archetype-readings');
  }

  return {
    eligible: reasons.length === 0,
    longitudinalConfidenceSignalCount,
    structuralSignalCount,
    archetypeReadingCount,
    reasons,
  };
}
