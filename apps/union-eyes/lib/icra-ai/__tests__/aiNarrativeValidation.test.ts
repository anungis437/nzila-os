import { describe, expect, it } from 'vitest';
import { buildNarrativeContext } from '../buildNarrativeContext';
import type { NarrativeContext } from '../narrativePromptContracts';
import { validateNarrativeOutput } from '../narrativeOutputValidator';

function sampleContext(): NarrativeContext {
  return buildNarrativeContext({
    artifactKind: 'ExecutiveSummary',
    locale: 'en-CA',
    maturityBands: [{ pillarId: 'PILLAR_GOV', band: 'established' }],
    adaptiveContext: {
      institutionalScale: 'mid',
      continuityComplexity: 'moderate',
      governanceComplexity: 'moderate',
      continuityExposure: 'stable',
      respondentLens: 'executive',
    },
    archetypes: [{ archetypeId: 'ARCH_STEWARD', canonicalSummary: 'stewardship oriented' }],
    breakpoints: [{ breakpointId: 'BP_LEAD_TRANSITION', canonicalDescription: 'leadership transition window' }],
    confidence: { confidenceBand: 'high', stabilityBand: 'stable' },
    structuralSignals: [{ signalId: 'SIG_BOARD_CADENCE', band: 'established' }],
    onboardingFindings: [],
    governanceObservations: [],
  });
}

describe('validateNarrativeOutput — safe narrative', () => {
  it('accepts governance-aware draft that references signal IDs', () => {
    const ctx = sampleContext();
    const text =
      'Reviewer note: continuity signals from PILLAR_GOV and SIG_BOARD_CADENCE suggest ' +
      'stewardship momentum (ARCH_STEWARD). Leadership transition window (BP_LEAD_TRANSITION) ' +
      'appears stable; further reviewer interpretation may refine emphasis.';
    const result = validateNarrativeOutput(text, ctx);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe('validateNarrativeOutput — prohibited categories', () => {
  const ctx = sampleContext();

  const samples: Array<{ name: string; text: string }> = [
    { name: 'punitive_grading', text: 'PILLAR_GOV: this is a high-risk organization with toxic culture.' },
    { name: 'autonomous_judgment', text: 'PILLAR_GOV: AI determined that the governance is established.' },
    { name: 'psychological_inference', text: 'PILLAR_GOV: members feel anxious and leadership feels anxious.' },
    { name: 'legal_conclusion', text: 'PILLAR_GOV: the institution is in breach of the act.' },
    { name: 'hr_diagnostic', text: 'PILLAR_GOV: a performance improvement plan is required for underperforming staff.' },
    { name: 'disclosure_misrepresentation', text: 'PILLAR_GOV: powered by AI insights, AI-generated insights below.' },
    { name: 'anti_surveillance', text: 'PILLAR_GOV: behavioural metadata and typing cadence flagged.' },
  ];

  for (const s of samples) {
    it(`rejects ${s.name}`, () => {
      const r = validateNarrativeOutput(s.text, ctx);
      expect(r.ok).toBe(false);
      expect(r.failures.length).toBeGreaterThan(0);
    });
  }
});

describe('validateNarrativeOutput — explainability gate', () => {
  it('rejects text that does not reference any signal identifier', () => {
    const ctx = sampleContext();
    const text = 'A general continuity observation may be developing further.';
    const r = validateNarrativeOutput(text, ctx);
    expect(r.failures.some((f) => f.gate === 'explainability')).toBe(true);
  });
});

describe('validateNarrativeOutput — certainty moderation', () => {
  it('rejects absolute predictive claims', () => {
    const ctx = sampleContext();
    const text = 'PILLAR_GOV: governance will fail next quarter.';
    const r = validateNarrativeOutput(text, ctx);
    expect(r.failures.some((f) => f.gate === 'certainty_moderation')).toBe(true);
  });
});
