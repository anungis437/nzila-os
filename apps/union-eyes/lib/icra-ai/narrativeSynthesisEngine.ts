/**
 * narrativeSynthesisEngine
 * ────────────────────────
 * Orchestrates the AI synthesis pipeline:
 *
 *   NarrativeContext
 *     → buildPromptInvocation
 *     → providerInvoke (caller-supplied; pluggable)
 *     → governNarrativeDraft
 *     → reviewStatus = 'draft'
 *
 * Caller supplies the provider invocation so the engine remains
 * environment-agnostic and unit-testable.
 */

import { buildPromptInvocation } from './systemPromptRegistry';
import { governNarrativeDraft, type GovernedNarrativeDraft } from './aiNarrativeGovernance';
import { SYNTHESIS_ENGINE_VERSION, type NarrativeContext } from './narrativePromptContracts';
import type { PromptInvocation } from './promptContracts';
import { initialReviewStatus, type ReviewedArtifact } from './reviewWorkflow';

export interface ProviderInvoke {
  (invocation: PromptInvocation): Promise<string>;
}

export interface SynthesizeNarrativeInput {
  readonly context: NarrativeContext;
  readonly providerInvoke: ProviderInvoke;
}

export interface SynthesizeNarrativeResult {
  readonly draft: GovernedNarrativeDraft;
  readonly reviewed: ReviewedArtifact;
  readonly invocation: PromptInvocation;
  readonly synthesisEngineVersion: typeof SYNTHESIS_ENGINE_VERSION;
}

export async function synthesizeNarrative(
  input: SynthesizeNarrativeInput,
): Promise<SynthesizeNarrativeResult> {
  const invocation = buildPromptInvocation(input.context);
  const raw = await input.providerInvoke(invocation);
  const draft = governNarrativeDraft(raw, input.context);
  const reviewed = initialReviewStatus({
    artifactKind: input.context.artifactKind,
    promptId: invocation.promptId,
    promptVersion: invocation.promptVersion,
    text: draft.text,
  });
  return {
    draft,
    reviewed,
    invocation,
    synthesisEngineVersion: SYNTHESIS_ENGINE_VERSION,
  };
}
