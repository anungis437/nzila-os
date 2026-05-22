import { describe, expect, it } from 'vitest';
import { buildNarrativeContext } from '../buildNarrativeContext';
import { FORBIDDEN_CONTEXT_KEYS } from '../narrativePromptContracts';
import { buildPromptInvocation } from '../systemPromptRegistry';

function baseInput() {
  return {
    artifactKind: 'ExecutiveSummary' as const,
    locale: 'en-CA' as const,
    maturityBands: [{ pillarId: 'PILLAR_GOV', band: 'established' as const }],
    adaptiveContext: {
      institutionalScale: 'mid',
      continuityComplexity: 'moderate',
      governanceComplexity: 'moderate',
      continuityExposure: 'stable',
      respondentLens: 'executive',
    },
    confidence: { confidenceBand: 'high' as const, stabilityBand: 'stable' as const },
  };
}

describe('buildNarrativeContext — forbidden key guard', () => {
  for (const key of FORBIDDEN_CONTEXT_KEYS) {
    it(`rejects forbidden key "${key}" at top level`, () => {
      const input = { ...baseInput(), [key]: 'leaked-value' };
      expect(() => buildNarrativeContext(input as never)).toThrow(/forbidden key/);
    });

    it(`rejects forbidden key "${key}" inside adaptiveContext`, () => {
      const input = {
        ...baseInput(),
        adaptiveContext: { ...baseInput().adaptiveContext, [key]: 'leaked' },
      };
      expect(() => buildNarrativeContext(input as never)).toThrow(/forbidden key/);
    });
  }
});

describe('buildPromptInvocation — serialized prompt boundary', () => {
  it('does not contain any forbidden key string in the rendered user prompt', () => {
    const ctx = buildNarrativeContext(baseInput());
    const invocation = buildPromptInvocation(ctx);
    for (const key of FORBIDDEN_CONTEXT_KEYS) {
      expect(invocation.userPrompt.includes(`"${key}"`)).toBe(false);
    }
  });
});
