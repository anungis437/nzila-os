/**
 * buildNarrativeContext
 * ─────────────────────
 * Pure builder that projects deterministic continuity signals into the typed
 * NarrativeContext passed to the AI synthesis layer. Strips any unexpected
 * keys defensively and refuses to embed forbidden fields.
 *
 * Doctrine: docs/oci/ai/AI_DATA_BOUNDARY_MODEL.md
 */

import {
  FORBIDDEN_CONTEXT_KEYS,
  PROMPT_REGISTRY_VERSION,
  SYNTHESIS_ENGINE_VERSION,
  type AdaptiveContextBands,
  type ArchetypeSignal,
  type ContinuityBreakpointSignal,
  type ContinuityConfidenceSignal,
  type GovernanceContinuityObservation,
  type MaturityBandSignal,
  type NarrativeArtifactKind,
  type NarrativeContext,
  type OnboardingSurvivabilityFinding,
  type StructuralContinuitySignal,
  type SupportedNarrativeLocale,
} from './narrativePromptContracts';

export interface BuildNarrativeContextInput {
  readonly artifactKind: NarrativeArtifactKind;
  readonly locale: SupportedNarrativeLocale;
  readonly maturityBands: ReadonlyArray<MaturityBandSignal>;
  readonly adaptiveContext: AdaptiveContextBands;
  readonly archetypes?: ReadonlyArray<ArchetypeSignal>;
  readonly breakpoints?: ReadonlyArray<ContinuityBreakpointSignal>;
  readonly confidence: ContinuityConfidenceSignal;
  readonly structuralSignals?: ReadonlyArray<StructuralContinuitySignal>;
  readonly onboardingFindings?: ReadonlyArray<OnboardingSurvivabilityFinding>;
  readonly governanceObservations?: ReadonlyArray<GovernanceContinuityObservation>;
  readonly reviewerSteer?: string;
}

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_CONTEXT_KEYS);

/**
 * Defensive sweep: throw if any caller-supplied object carries a forbidden
 * key. This is belt-and-suspenders: TypeScript already prevents this at the
 * boundary, but a runtime guard is cheap and tests can rely on it.
 */
function assertNoForbiddenKeys(input: Record<string, unknown>, path: string): void {
  for (const k of Object.keys(input)) {
    if (FORBIDDEN_KEY_SET.has(k)) {
      throw new Error(
        `[ai/buildNarrativeContext] forbidden key "${k}" at ${path}; ` +
          'see docs/oci/ai/AI_DATA_BOUNDARY_MODEL.md',
      );
    }
  }
}

export function buildNarrativeContext(
  input: BuildNarrativeContextInput,
): NarrativeContext {
  assertNoForbiddenKeys(input as any as Record<string, unknown>, 'input');
  assertNoForbiddenKeys(
    input.adaptiveContext as any as Record<string, unknown>,
    'input.adaptiveContext',
  );

  const reviewerSteer = input.reviewerSteer?.trim();

  return Object.freeze({
    artifactKind: input.artifactKind,
    locale: input.locale,
    synthesisEngineVersion: SYNTHESIS_ENGINE_VERSION,
    promptRegistryVersion: PROMPT_REGISTRY_VERSION,
    maturityBands: Object.freeze([...input.maturityBands]),
    adaptiveContext: Object.freeze({ ...input.adaptiveContext }),
    archetypes: Object.freeze([...(input.archetypes ?? [])]),
    breakpoints: Object.freeze([...(input.breakpoints ?? [])]),
    confidence: Object.freeze({ ...input.confidence }),
    structuralSignals: Object.freeze([...(input.structuralSignals ?? [])]),
    onboardingFindings: Object.freeze([...(input.onboardingFindings ?? [])]),
    governanceObservations: Object.freeze([
      ...(input.governanceObservations ?? []),
    ]),
    ...(reviewerSteer && reviewerSteer.length > 0
      ? { reviewerSteer }
      : {}),
  });
}
