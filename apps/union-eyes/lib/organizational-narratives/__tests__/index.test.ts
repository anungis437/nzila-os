import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ detect: vi.fn() }));

vi.mock('@nzila/organizational-cognition-core', () => ({
  detectForbiddenVocabulary: h.detect,
}));

import {
  composeExecutiveBriefing,
  narrateEnvelope,
  narrateEnvelopes,
  NARRATIVE_VERSION,
  type InstitutionalNarrative,
} from '../index';

type Env = Parameters<typeof narrateEnvelope>[0];

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    domain: 'governance',
    confidence: 'high',
    interpretationGuidance: 'Governance continuity is stable. A second sentence here adds detail.',
    evidence: [{ id: 'e1' }, { id: 'e2' }],
    governanceImplications: [
      { severity: 'high', implication: 'Review the renewal cadence', requiresHumanReview: true },
      { severity: 'low', implication: 'Maintain current documentation', requiresHumanReview: false },
    ],
    reasoning: [
      { step: 2, rationale: 'Second reasoning step' },
      { step: 1, rationale: 'First reasoning step' },
      { step: 3, rationale: 'Third reasoning step' },
    ],
    provenance: { engine: 'continuity-forecaster' },
    ...overrides,
  } as unknown as Env;
}

beforeEach(() => {
  h.detect.mockReset().mockReturnValue([]);
});

describe('lib/organizational-narratives/index', () => {
  it('narrateEnvelope projects an envelope into a calm narrative', () => {
    const n = narrateEnvelope(env());
    expect(n.engine).toBe('continuity-forecaster');
    expect(n.domain).toBe('governance');
    expect(n.headline).toBe('Governance continuity is stable.');
    expect(n.summary).toContain('2 institutional evidence items');
    expect(n.summary).toContain('with high confidence');
    expect(n.summary).toContain('1 governance implication flagged');
    // keyReasoning sorted by step, max 4
    expect(n.keyReasoning).toEqual(['First reasoning step', 'Second reasoning step', 'Third reasoning step']);
    expect(n.reviewSignals[0]).toContain('[HIGH]');
    expect(n.reviewSignals[0]).toContain('review required');
    expect(n.reviewSignals[1]).toContain('[low]');
    expect(n.confidence).toBe('high');
    expect(n.narrativeVersion).toBe(NARRATIVE_VERSION);
  });

  it('narrateEnvelope truncates a long headline to 160 chars', () => {
    const long = 'X'.repeat(200);
    const n = narrateEnvelope(env({ interpretationGuidance: long }));
    expect(n.headline.length).toBe(160);
    expect(n.headline.endsWith('...')).toBe(true);
  });

  it('narrateEnvelope handles single evidence and no review signals', () => {
    const n = narrateEnvelope(
      env({
        evidence: [{ id: 'only' }],
        confidence: 'unknown_band',
        governanceImplications: [{ severity: 'low', implication: 'ok', requiresHumanReview: false }],
      }),
    );
    expect(n.summary).toContain('1 institutional evidence item ');
    expect(n.summary).not.toContain('flagged for human review');
  });

  it('narrateEnvelope throws when forbidden vocabulary is detected', () => {
    h.detect.mockReturnValue([{ message: 'forbidden term: optimize' }]);
    expect(() => narrateEnvelope(env())).toThrow(/forbidden vocabulary/);
  });

  it('narrateEnvelopes records failures without failing the batch', () => {
    h.detect.mockImplementation((text: string) =>
      text.includes('Risk language') ? [{ message: 'bad' }] : [],
    );
    const result = narrateEnvelopes([
      env(),
      env({ provenance: { engine: 'risk-detector' }, interpretationGuidance: 'Risk language here.' }),
    ]);
    expect(Object.keys(result.narratives)).toEqual(['continuity-forecaster']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].engine).toBe('risk-detector');
  });

  it('composeExecutiveBriefing sorts by review + confidence and dedupes signals', () => {
    const mk = (engine: string, confidence: string, reviewSignals: string[]): InstitutionalNarrative => ({
      engine, domain: 'governance', headline: 'h', summary: 's',
      keyReasoning: [], reviewSignals, confidence, narrativeVersion: NARRATIVE_VERSION,
    });
    const briefing = composeExecutiveBriefing([
      mk('a', 'low', []),
      mk('b', 'very_high', ['[HIGH] shared signal']),
      mk('c', 'moderate', ['[HIGH] shared signal', '[MED] other']),
    ]);
    expect(briefing.organizationalScope).toBe(true);
    expect(briefing.highlights[0].engine).toBe('b');
    expect(briefing.reviewSignals).toEqual(['[HIGH] shared signal', '[MED] other']);
    expect(briefing.briefingVersion).toBe('1.0.0');
  });
});
