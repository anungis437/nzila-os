/**
 * ARTIFACT TYPE: IP / Module
 * PACKAGE: @nzila/oci-confidence
 * MODULE: interpretive-cautions
 * DOCTRINE_VERSION: 1.0.0
 *
 * Canonical caution-state vocabulary and posture sentences. Posture
 * sentences are reviewer-safe, calm, and never alarmist.
 */

import type { CautionState } from './confidenceContracts';

const POSTURES: Readonly<Record<CautionState, string>> = Object.freeze({
  SMALL_SAMPLE:
    'Sample size is below the methodology threshold; treat this reading as provisional pending broader institutional input.',
  INCOMPLETE_VISIBILITY:
    'Expected evidence categories are incomplete; the reading reflects only what was visible to the reviewer.',
  HIGH_VARIANCE:
    'Reviewer interpretation showed elevated variance; classification is held with reduced confidence pending reconciliation.',
  TRANSITIONAL_INSTABILITY:
    'The institution is mid-transition; readings taken in transition windows are temporally unstable by design.',
  OUTDATED_ASSESSMENT:
    'The underlying assessment is older than the methodology recommends; refresh the inputs before relying on the classification.',
  LIMITED_GOVERNANCE_EVIDENCE:
    'Governance evidence was not present at the threshold the methodology requires; classification is structural rather than evidentiary.',
});

/** Returns the canonical posture sentence for a caution state. */
export function postureFor(caution: CautionState): string {
  return POSTURES[caution];
}

/** Returns posture sentences for a set of cautions, preserving order and deduplicating. */
export function posturesFor(cautions: ReadonlyArray<CautionState>): ReadonlyArray<string> {
  const seen = new Set<CautionState>();
  const out: string[] = [];
  for (const c of cautions) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(POSTURES[c]);
  }
  return Object.freeze(out);
}

export const CAUTION_POSTURES = POSTURES;
