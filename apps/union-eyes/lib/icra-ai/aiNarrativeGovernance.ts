/**
 * aiNarrativeGovernance
 * ─────────────────────
 * The single-call governance pipeline that every AI synthesis flow MUST use
 * before surfacing a draft to a reviewer:
 *
 *   buildPromptInvocation(context)
 *     → invoke model
 *     → governNarrativeDraft(rawOutput, context)
 *
 * The pipeline returns either a sanitized, validated draft or a structured
 * rejection. Callers never surface a draft that did not pass.
 */

import {
  validateNarrativeOutput,
  type NarrativeValidationResult,
} from './narrativeOutputValidator';
import type { NarrativeContext } from './narrativePromptContracts';

export interface GovernedNarrativeDraft {
  readonly status: 'accepted' | 'rejected';
  readonly text: string;
  readonly validation: NarrativeValidationResult;
}

/**
 * Lightweight sanitizer that trims trailing whitespace, collapses excessive
 * blank lines, and removes leading bullet noise that some models emit. Does
 * NOT alter content meaning.
 */
function sanitize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function governNarrativeDraft(
  rawOutput: string,
  context: NarrativeContext,
): GovernedNarrativeDraft {
  const text = sanitize(rawOutput);
  const validation = validateNarrativeOutput(text, context);
  return {
    status: validation.ok ? 'accepted' : 'rejected',
    text,
    validation,
  };
}
