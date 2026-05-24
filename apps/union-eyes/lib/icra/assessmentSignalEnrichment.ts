/**
 * Assessment Signal Enrichment — Product 5 longitudinal intelligence input.
 *
 * Consolidates confidence signals, structural signals, archetype readings,
 * and institutional patterns into a single per-assessment enrichment
 * envelope, ready for ingest by Product 5 trajectory aggregation.
 *
 * No PII. No reviewer or institution identifiers — the assessment id is the
 * pseudonymous handle, anonymized further upstream by intelligence-network
 * validators.
 */

import type { Answer, DimensionScore, Question } from './types';
import {
  deriveConfidenceSignals,
  aggregateConfidenceByDomain,
  type ContinuityConfidenceSignal,
  type ContinuityConfidenceDomain,
} from './continuityConfidenceSignals';
import {
  deriveStructuralSignals,
  type StructuralContinuitySignal,
} from './structuralContinuitySignals';
import {
  detectContinuityArchetypes,
  type ContinuityArchetypeReading,
} from './continuityArchetypeSignals';
import {
  detectInstitutionalPatterns,
  type InstitutionalPattern,
} from './institutionalPatternDetection';

export interface AssessmentSignalEnrichment {
  assessmentId: string;
  generatedAt: string;
  confidenceSignals: ContinuityConfidenceSignal[];
  confidenceByDomain: Record<ContinuityConfidenceDomain, number | null>;
  structuralSignals: StructuralContinuitySignal[];
  archetypeReadings: ContinuityArchetypeReading[];
  institutionalPatterns: InstitutionalPattern[];
}

export function buildAssessmentSignalEnrichment(input: {
  assessmentId: string;
  answers: Answer[];
  questions: ReadonlyArray<Question>;
  dimensionScores?: DimensionScore[];
}): AssessmentSignalEnrichment {
  const confidenceSignals = deriveConfidenceSignals(input.answers, input.questions);
  const structuralSignals = deriveStructuralSignals(input.answers, input.questions);
  const archetypeReadings = detectContinuityArchetypes({
    structuralSignals,
    confidenceSignals,
    dimensionScores: input.dimensionScores,
  });
  const institutionalPatterns = detectInstitutionalPatterns({
    archetypeReadings,
    dimensionScores: input.dimensionScores,
  });

  return {
    assessmentId: input.assessmentId,
    generatedAt: new Date().toISOString(),
    confidenceSignals,
    confidenceByDomain: aggregateConfidenceByDomain(confidenceSignals),
    structuralSignals,
    archetypeReadings,
    institutionalPatterns,
  };
}
