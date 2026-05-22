/**
 * facilitatorSummaryGenerator
 * ───────────────────────────
 * Synthesizes a `FacilitatorSummary` artefact. AI may help summarize
 * workshop themes, group continuity concerns, identify repeated operational
 * patterns, and propose follow-up facilitation questions. AI must NOT
 * determine truth, override facilitator interpretation, rank participants,
 * infer emotional states, or infer internal politics.
 */

import { buildNarrativeContext, type BuildNarrativeContextInput } from './buildNarrativeContext';
import {
  synthesizeNarrative,
  type ProviderInvoke,
  type SynthesizeNarrativeResult,
} from './narrativeSynthesisEngine';

export type GenerateFacilitatorSummaryInput = Omit<
  BuildNarrativeContextInput,
  'artifactKind'
> & {
  readonly providerInvoke: ProviderInvoke;
};

export async function generateFacilitatorSummary(
  input: GenerateFacilitatorSummaryInput,
): Promise<SynthesizeNarrativeResult> {
  const { providerInvoke, ...rest } = input;
  const context = buildNarrativeContext({
    ...rest,
    artifactKind: 'FacilitatorSummary',
  });
  return synthesizeNarrative({ context, providerInvoke });
}
