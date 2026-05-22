/**
 * Signal Contribution Integrity — verifies that confidence and structural
 * signals derive deterministically from answers and that archetype mappings
 * are coherent.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../questions';
import { buildAnswer } from '../scoring';
import {
  deriveConfidenceSignals,
  aggregateConfidenceByDomain,
} from '../continuityConfidenceSignals';
import {
  deriveStructuralSignals,
  QUESTION_OPTION_PATTERNS,
} from '../structuralContinuitySignals';
import { detectContinuityArchetypes } from '../continuityArchetypeSignals';
import { buildAssessmentSignalEnrichment } from '../assessmentSignalEnrichment';
import { evaluateLongitudinalQuality } from '../longitudinalSignalQuality';
import type { LikertQuestion, MultipleChoiceQuestion } from '../types';

const LIKERT = ALL_QUESTIONS.filter((q): q is LikertQuestion => q.type === 'likert_5');
const MC = ALL_QUESTIONS.filter((q): q is MultipleChoiceQuestion => q.type === 'multiple_choice');

describe('Confidence signal derivation', () => {
  it('every likert_5 question yields exactly one signal when answered', () => {
    const answers = LIKERT.map((q) => buildAnswer(q, 3));
    const signals = deriveConfidenceSignals(answers, ALL_QUESTIONS);
    expect(signals.length).toBe(LIKERT.length);
  });

  it('confidence equals normalized score; ambiguity peaks at midpoint', () => {
    const q = LIKERT[0];
    const mid = buildAnswer(q, 3);
    const [signalMid] = deriveConfidenceSignals([mid], ALL_QUESTIONS);
    expect(signalMid.confidence).toBeCloseTo(0.5, 5);
    expect(signalMid.ambiguity).toBeCloseTo(1, 5);

    const extreme = buildAnswer(q, 5);
    const [signalExtreme] = deriveConfidenceSignals([extreme], ALL_QUESTIONS);
    expect(signalExtreme.confidence).toBeCloseTo(1, 5);
    expect(signalExtreme.ambiguity).toBeCloseTo(0, 5);
  });

  it('aggregation returns null for unrepresented domains', () => {
    const out = aggregateConfidenceByDomain([]);
    for (const v of Object.values(out)) expect(v).toBeNull();
  });
});

describe('Structural signal derivation', () => {
  it('every multiple_choice question has an option→pattern mapping', () => {
    for (const q of MC) {
      const mapping = QUESTION_OPTION_PATTERNS[q.id];
      expect(mapping, `no mapping for ${q.id}`).toBeDefined();
      for (const opt of q.options) {
        expect(mapping[opt.value], `${q.id}: option ${opt.value} unmapped`).toBeDefined();
      }
    }
  });

  it('each structural signal carries at least one archetype', () => {
    const answers = MC.map((q) => buildAnswer(q, q.options[0].value));
    const signals = deriveStructuralSignals(answers, ALL_QUESTIONS);
    for (const s of signals) expect(s.archetypes.length).toBeGreaterThan(0);
  });
});

describe('Archetype detection coherence', () => {
  it('archetype readings are derived only from observed patterns', () => {
    const readings = detectContinuityArchetypes({
      structuralSignals: [],
      confidenceSignals: [],
    });
    expect(readings).toEqual([]);
  });

  it('multiple supporting patterns escalate archetype strength', () => {
    const all = MC.map((q) => buildAnswer(q, q.options[q.options.length - 1].value));
    const signals = deriveStructuralSignals(all, ALL_QUESTIONS);
    const readings = detectContinuityArchetypes({
      structuralSignals: signals,
      confidenceSignals: [],
    });
    const pronounced = readings.find((r) => r.strength === 'pronounced');
    expect(pronounced).toBeDefined();
  });
});

describe('Assessment enrichment + longitudinal quality', () => {
  it('full enrichment surfaces confidence + structural + archetype data', () => {
    const answers = [
      ...LIKERT.map((q) => buildAnswer(q, 4)),
      ...MC.map((q) => buildAnswer(q, q.options[0].value)),
    ];
    const enrichment = buildAssessmentSignalEnrichment({
      assessmentId: 'a_test_enrichment',
      answers,
      questions: ALL_QUESTIONS,
    });
    expect(enrichment.confidenceSignals.length).toBe(LIKERT.length);
    expect(enrichment.structuralSignals.length).toBe(MC.length);
    expect(enrichment.archetypeReadings.length).toBeGreaterThan(0);
  });

  it('empty enrichment is ineligible for longitudinal ingest', () => {
    const enrichment = buildAssessmentSignalEnrichment({
      assessmentId: 'a_empty',
      answers: [],
      questions: ALL_QUESTIONS,
    });
    const quality = evaluateLongitudinalQuality(enrichment);
    expect(quality.eligible).toBe(false);
    expect(quality.reasons).toContain('insufficient-longitudinal-confidence-signals');
  });
});
