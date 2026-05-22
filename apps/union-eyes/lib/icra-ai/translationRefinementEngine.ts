/**
 * translationRefinementEngine
 * ───────────────────────────
 * AI-assisted bilingual refinement (EN-CA ↔ FR-CA) of reviewer-approved
 * narrative drafts. The engine MUST preserve continuity meaning; it may
 * only refine governance terminology consistency, continuity terminology
 * harmonization, and readability.
 *
 * Hard rules:
 *   - never change continuity meaning
 *   - never soften critical findings deceptively
 *   - never add interpretation not present in the source
 *
 * The deterministic validator below performs a meaning-preservation check
 * after refinement.
 */

import { findProhibitedPatterns } from './prohibitedAiPatterns';

export type RefinementDirection = 'en-CA→fr-CA' | 'fr-CA→en-CA';

export interface TranslationRefinementInput {
  readonly direction: RefinementDirection;
  /** Reviewer-approved source narrative (NOT AI raw output). */
  readonly source: string;
  /** AI-refined candidate translation. */
  readonly candidate: string;
  /** Deterministic signal identifiers that MUST be preserved across the refinement. */
  readonly preservedSignalIds: ReadonlyArray<string>;
}

export type TranslationRefinementFailure =
  | { reason: 'signal_dropped'; signalId: string }
  | { reason: 'prohibited_pattern'; description: string; excerpt: string }
  | { reason: 'critical_finding_softened'; evidence: string };

export interface TranslationRefinementResult {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<TranslationRefinementFailure>;
}

const CRITICAL_FINDING_SOFTENERS: ReadonlyArray<RegExp> = [
  /\b(?:significant|material|elevated|critical)\b/i,
];

export function validateTranslationRefinement(
  input: TranslationRefinementInput,
): TranslationRefinementResult {
  const failures: TranslationRefinementFailure[] = [];

  // Signal preservation: every signal identifier present in the source must
  // also appear in the candidate (identifiers are language-neutral).
  for (const id of input.preservedSignalIds) {
    if (input.source.includes(id) && !input.candidate.includes(id)) {
      failures.push({ reason: 'signal_dropped', signalId: id });
    }
  }

  // Prohibited patterns must not be introduced by the refinement.
  for (const m of findProhibitedPatterns(input.candidate)) {
    failures.push({
      reason: 'prohibited_pattern',
      description: m.description,
      excerpt: m.excerpt,
    });
  }

  // Critical-finding softening: if the source uses critical-grade terms and
  // the candidate does not preserve any equivalent intensity marker, flag it.
  const sourceUsesCritical = CRITICAL_FINDING_SOFTENERS.some((re) =>
    re.test(input.source),
  );
  if (sourceUsesCritical) {
    const candidateHasIntensity = /\b(?:important|significatif|élevé|critique|substantial|material)\b/i.test(
      input.candidate,
    );
    if (!candidateHasIntensity) {
      failures.push({
        reason: 'critical_finding_softened',
        evidence: 'source contains critical-intensity language without equivalent in candidate',
      });
    }
  }

  return {
    ok: failures.length === 0,
    failures: Object.freeze(failures),
  };
}
