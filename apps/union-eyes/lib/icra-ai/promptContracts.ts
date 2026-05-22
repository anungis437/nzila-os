/**
 * promptContracts
 * ───────────────
 * Typed contract for a registered system prompt. Each entry pairs a
 * NarrativeArtifactKind with a guardrail-stamped prompt and a registry
 * version. See `systemPromptRegistry.ts` for instances.
 */

import type { NarrativeArtifactKind } from './narrativePromptContracts';

export interface RegisteredPrompt {
  readonly artifactKind: NarrativeArtifactKind;
  readonly promptId: string;
  readonly version: string;
  /**
   * The system-prompt body MUST begin with the guardrail block (stamped via
   * `stampGuardrail` from `promptGuardrails.ts`). The registry rejects any
   * entry that does not satisfy `hasGuardrail`.
   */
  readonly systemPrompt: string;
}

export interface PromptInvocation {
  readonly artifactKind: NarrativeArtifactKind;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
}
