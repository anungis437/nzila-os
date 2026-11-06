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
    // The headline states what the result rests on, never the engine's fixed guidance (DEF-0B7-COGB-NARRATIVES-CITE-ZERO-EVIDENCE).
    expect(n.headline).toBe('governance: result cites 2 institutional records.');
    expect(n.guidance).toBe('Governance continuity is stable. A second sentence here adds detail.');
    expect(n.evidenceCount).toBe(2);
    expect(n.summary).toContain('Guidance: Governance continuity is stable.');
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
    const n = narrateEnvelope(env({ domain: long }));
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
      engine, domain: 'governance', headline: 'h', summary: 's', guidance: 'g', evidenceCount: 0,
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

  it('narrateEnvelope never uses the fixed guidance as the headline when the result cites no evidence', () => {
    const n = narrateEnvelope(env({ evidence: [], confidence: 'insufficient_data' }));
    expect(n.headline).toBe('No evidence-backed finding for governance: the result cites no institutional record.');
    expect(n.headline).not.toContain('Governance continuity is stable');
    expect(n.summary).toContain('No institutional evidence is attached');
    expect(n.summary).not.toContain('Derived from');
    expect(n.evidenceCount).toBe(0);
  });

  it('composeExecutiveBriefing ranks a narrative that cites records above one that cites none, with no review signal either way', () => {
    const mk = (engine: string, confidence: string, evidenceCount: number): InstitutionalNarrative => ({
      engine, domain: 'governance', headline: 'h', summary: 's', guidance: 'g', evidenceCount,
      keyReasoning: [], reviewSignals: [], confidence, narrativeVersion: NARRATIVE_VERSION,
    });
    const briefing = composeExecutiveBriefing([
      mk('guidance-only', 'insufficient_data', 0),
      mk('cites-records', 'insufficient_data', 3),
    ]);
    expect(briefing.highlights.map((n) => n.engine)).toEqual(['cites-records', 'guidance-only']);
  });
});
