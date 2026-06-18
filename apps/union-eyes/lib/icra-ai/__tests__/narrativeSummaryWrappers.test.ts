import { describe, expect, it, vi } from 'vitest';

const { buildNarrativeContext, synthesizeNarrative } = vi.hoisted(() => ({
  buildNarrativeContext: vi.fn((input: unknown) => ({ context: input })),
  synthesizeNarrative: vi.fn(async (args: unknown) => ({ synthesized: args })),
}));

vi.mock('../buildNarrativeContext', () => ({ buildNarrativeContext }));
vi.mock('../narrativeSynthesisEngine', () => ({ synthesizeNarrative }));

import { generateExecutiveSummary } from '../generateExecutiveSummary';
import { generateFacilitatorSummary } from '../facilitatorSummaryGenerator';

describe('lib/icra-ai narrative wrappers', () => {
  it('generateExecutiveSummary builds an ExecutiveSummary context then synthesizes', async () => {
    const providerInvoke = vi.fn();
    const result = await generateExecutiveSummary({ providerInvoke, foo: 'bar' } as never);

    expect(buildNarrativeContext).toHaveBeenCalledWith(
      expect.objectContaining({ artifactKind: 'ExecutiveSummary', foo: 'bar' }),
    );
    expect(buildNarrativeContext).not.toHaveBeenCalledWith(
      expect.objectContaining({ providerInvoke }),
    );
    expect(synthesizeNarrative).toHaveBeenCalledWith(
      expect.objectContaining({ providerInvoke }),
    );
    expect(result).toBeDefined();
  });

  it('generateFacilitatorSummary builds a FacilitatorSummary context then synthesizes', async () => {
    const providerInvoke = vi.fn();
    await generateFacilitatorSummary({ providerInvoke, theme: 'x' } as never);

    expect(buildNarrativeContext).toHaveBeenCalledWith(
      expect.objectContaining({ artifactKind: 'FacilitatorSummary', theme: 'x' }),
    );
    expect(synthesizeNarrative).toHaveBeenCalledWith(
      expect.objectContaining({ providerInvoke }),
    );
  });
});
