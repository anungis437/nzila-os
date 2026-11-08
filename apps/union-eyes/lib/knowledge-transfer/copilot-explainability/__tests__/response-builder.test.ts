import { describe, expect, it } from 'vitest';
import {
  assessConfidence,
  buildExplainabilityEnvelope,
  buildExplainableResponse,
  buildPropagationEvidence,
  buildGovernanceFlags,
} from '../response-builder';
import type { EvidenceReference } from '../explainability-models';

function ev(confidence: 'high' | 'medium' | 'low'): EvidenceReference {
  return { observation: 'o', dataPoint: 'd', sourceType: 'graph_computation', confidence };
}

describe('lib/knowledge-transfer/copilot-explainability/response-builder', () => {
  it('assessConfidence covers all bands', () => {
    expect(assessConfidence([])).toBe('insufficient_data');
    expect(assessConfidence([ev('high'), ev('high'), ev('high')])).toBe('high');
    expect(assessConfidence([ev('high'), ev('medium'), ev('medium'), ev('low')])).toBe('medium');
    expect(assessConfidence([ev('high'), ev('low'), ev('low'), ev('low'), ev('low')])).toBe('low');
    expect(assessConfidence([ev('low'), ev('low'), ev('low'), ev('low'), ev('low')])).toBe('insufficient_data');
  });

  it('buildExplainabilityEnvelope assembles fields with derived confidence', () => {
    const env = buildExplainabilityEnvelope(
      [ev('high'), ev('high')],
      [{ step: 1, statement: 's', basis: 'b' } as never],
      ['assume'],
      [],
      ['limit'],
      'verify here',
    );
    expect(env.overallConfidence).toBe('high');
    expect(env.assumptions).toEqual(['assume']);
    expect(env.limitations).toEqual(['limit']);
    expect(env.verificationGuidance).toBe('verify here');
  });

  it('buildExplainableResponse wraps an answer', () => {
    const env = buildExplainabilityEnvelope([], [], [], [], [], 'g');
    const res = buildExplainableResponse('analysis' as never, 'answer', 'summary', env, ['next?'], 'ctx');
    expect(res.answer).toBe('answer');
    expect(res.summary).toBe('summary');
    expect(res.followUpSuggestions).toEqual(['next?']);
    expect(res.organizationalContext).toBe('ctx');
    expect(res.generatedAt).toBeDefined();
  });

  it('buildPropagationEvidence builds references when data present', () => {
    const refs = buildPropagationEvidence(3, 10, 2);
    expect(refs.length).toBe(2);
    expect(refs[0].dataPoint).toContain('30%');
    expect(refs[1].observation).toContain('2 operational bottlenecks');
  });

  it('buildPropagationEvidence returns empty with no nodes or bottlenecks', () => {
    expect(buildPropagationEvidence(0, 0, 0)).toEqual([]);
  });

  // DEF-0B7-EXC-COPILOT-EXPLAINABILITY-IS-FIXED-TEXT-AND-NOT-STORED: evidence confidence must come from how many
  // nodes/signals underlie it, never a fixed 'high' literal regardless of volume.
  it('buildPropagationEvidence derives confidence from count, not a fixed literal', () => {
    const sparse = buildPropagationEvidence(1, 2, 1);
    expect(sparse[0].confidence).toBe('low');
    expect(sparse[1].confidence).toBe('low');
    const moderate = buildPropagationEvidence(3, 10, 2);
    expect(moderate[0].confidence).toBe('medium');
    expect(moderate[1].confidence).toBe('medium');
    const abundant = buildPropagationEvidence(8, 10, 6);
    expect(abundant[0].confidence).toBe('high');
    expect(abundant[1].confidence).toBe('high');
  });

  it('buildGovernanceFlags computes severity bands', () => {
    expect(buildGovernanceFlags(0, 5)).toEqual([]);
    expect(buildGovernanceFlags(4, 5)[0].severity).toBe('significant');
    expect(buildGovernanceFlags(2, 5)[0].severity).toBe('moderate');
    expect(buildGovernanceFlags(1, 10)[0].severity).toBe('informational');
  });
});
