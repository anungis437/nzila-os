/**
 * Evidence Branching Engine — pure function. Given a respondent's declared
 * evidence level for a claim, returns the set of follow-up question ids
 * the OCRA flow must surface to validate higher-level claims.
 *
 * Branching contract:
 *   - higher claimed levels MUST trigger follow-ups to substantiate them
 *   - lower claimed levels MUST NOT trigger validation prompts (the
 *     claim itself is the answer)
 *   - branching is monotonic: a claim of OPERATIONAL surfaces all
 *     follow-ups required for DOCUMENTED *plus* those required for
 *     OPERATIONAL
 */
import {
  EVIDENCE_LEVELS,
  type EvidenceLevel,
  isAtLeast,
} from './evidenceTaxonomy';

export interface EvidenceBranchRule {
  /** The triggering level — when the respondent claims at least this level, surface the followups. */
  minLevel: EvidenceLevel;
  /** Follow-up question ids in the v2 registry. */
  enables: ReadonlyArray<string>;
}

/**
 * Resolve which followup question ids are enabled by a respondent's
 * declared evidence level.
 */
export function resolveBranching(
  claimedLevel: EvidenceLevel,
  rules: ReadonlyArray<EvidenceBranchRule>,
): ReadonlyArray<string> {
  const out: string[] = [];
  for (const rule of rules) {
    if (isAtLeast(claimedLevel, rule.minLevel)) {
      for (const id of rule.enables) {
        if (!out.includes(id)) out.push(id);
      }
    }
  }
  return out;
}

/**
 * Compute the *evidenced-vs-declared* gap for a claim. Returns a number
 * in 0..1 where 0 = no gap (claim matches evidence) and 1 = maximum
 * gap (claimed CROSS_VALIDATED, evidenced NONE).
 *
 * Drives the confidence-engine penalty when a respondent later admits
 * lower actual evidence during reviewer escalation.
 */
export function declaredVsEvidencedGap(
  declared: EvidenceLevel,
  evidenced: EvidenceLevel,
): number {
  const dDelta = EVIDENCE_LEVELS[declared].ordinal - EVIDENCE_LEVELS[evidenced].ordinal;
  if (dDelta <= 0) return 0;
  return dDelta / 5;
}
