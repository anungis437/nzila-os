/**
 * generateExecutiveSummary
 * ────────────────────────
 * Convenience wrapper that synthesizes an `ExecutiveSummary` artefact from
 * structured continuity signals. Uses the canonical pipeline:
 *
 *   buildNarrativeContext → synthesizeNarrative → governed draft → review
 *
 * The caller supplies a `providerInvoke` so this module remains
 * environment-agnostic and unit-testable.
 */

import { buildNarrativeContext, type BuildNarrativeContextInput } from './buildNarrativeContext';
import {
  synthesizeNarrative,
  type ProviderInvoke,
  type SynthesizeNarrativeResult,
} from './narrativeSynthesisEngine';

export type GenerateExecutiveSummaryInput = Omit<
  BuildNarrativeContextInput,
  'artifactKind'
> & {
  readonly providerInvoke: ProviderInvoke;
};

export async function generateExecutiveSummary(
  input: GenerateExecutiveSummaryInput,
): Promise<SynthesizeNarrativeResult> {
  const { providerInvoke, ...rest } = input;
  const context = buildNarrativeContext({
    ...rest,
    artifactKind: 'ExecutiveSummary',
  });
  return synthesizeNarrative({ context, providerInvoke });
}
