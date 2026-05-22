/**
 * narrativeOutputValidator
 * ────────────────────────
 * Validates an AI-generated narrative draft against the OCRA AI doctrine.
 * Runs the seven validation gates from OCRA_AI_BOUNDARY_MODEL.md:
 *
 *   1. Tone
 *   2. Governance-safe language
 *   3. Explainability
 *   4. Certainty moderation
 *   5. Reviewer-presence
 *   6. Anti-surveillance
 *   7. Institutional dignity
 */

import {
  findProhibitedPatterns,
  type ProhibitedPatternMatch,
} from './prohibitedAiPatterns';
import type { NarrativeContext } from './narrativePromptContracts';

export type ValidationGate =
  | 'tone'
  | 'governance_safe_language'
  | 'explainability'
  | 'certainty_moderation'
  | 'reviewer_presence'
  | 'anti_surveillance'
  | 'institutional_dignity';

export interface ValidationFailure {
  readonly gate: ValidationGate;
  readonly reason: string;
  readonly evidence?: string;
}

export interface NarrativeValidationResult {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<ValidationFailure>;
  readonly prohibitedMatches: ReadonlyArray<ProhibitedPatternMatch>;
}

const CERTAINTY_INFLATIONS: ReadonlyArray<RegExp> = [
  /\bwill\s+(?:fail|collapse|breach|cause)\b/i,
  /\bis\s+guaranteed\s+to\b/i,
  /\bcertainly\s+will\b/i,
  /\bdefinitely\s+(?:will|is)\b/i,
];

const PUNITIVE_TONE: ReadonlyArray<RegExp> = [
  /\b(?:dangerous|alarming|catastrophic|disastrous)\b/i,
  /\boutright\s+failure\b/i,
];

const DIGNITY_OFFENDERS: ReadonlyArray<RegExp> = [
  /\binstitution\s+is\s+(?:bad|inferior|broken)\b/i,
  /\blesser\s+institution\b/i,
];

const REVIEWER_PRESENCE_HINTS: ReadonlyArray<RegExp> = [
  /\b(?:reviewer|reviewer-led|reviewer review|review note|review|reviewed|approved by|interpretation|draft|read by)\b/i,
];

export function validateNarrativeOutput(
  text: string,
  context: NarrativeContext,
): NarrativeValidationResult {
  const failures: ValidationFailure[] = [];
  const prohibited = findProhibitedPatterns(text);

  // Gate 2 + 6 + parts of 1/7 — collapse prohibited-pattern hits into
  // appropriate gate failures.
  for (const m of prohibited) {
    const gate: ValidationGate =
      m.category === 'anti_surveillance'
        ? 'anti_surveillance'
        : m.category === 'psychological_inference' ||
            m.category === 'legal_conclusion' ||
            m.category === 'hr_diagnostic'
          ? 'governance_safe_language'
          : m.category === 'punitive_grading'
            ? 'institutional_dignity'
            : 'tone';
    failures.push({
      gate,
      reason: `prohibited pattern: ${m.description}`,
      evidence: m.excerpt,
    });
  }

  // Gate 1 — tone
  for (const re of PUNITIVE_TONE) {
    const m = text.match(re);
    if (m) {
      failures.push({
        gate: 'tone',
        reason: 'punitive tone',
        evidence: m[0],
      });
    }
  }

  // Gate 3 — explainability: must reference at least one deterministic
  // signal identifier from the context.
  const signalIds = collectSignalIds(context);
  const referencesAnySignal = signalIds.some((id) => text.includes(id));
  if (signalIds.length > 0 && !referencesAnySignal) {
    failures.push({
      gate: 'explainability',
      reason:
        'narrative does not reference any deterministic signal identifier from the context',
    });
  }

  // Gate 4 — certainty moderation
  for (const re of CERTAINTY_INFLATIONS) {
    const m = text.match(re);
    if (m) {
      failures.push({
        gate: 'certainty_moderation',
        reason: 'absolute or predictive claim',
        evidence: m[0],
      });
    }
  }

  // Gate 5 — reviewer presence: artefact must read as a draft, not a
  // unilateral conclusion. Heuristic: language that explicitly invokes
  // reviewer/interpretation framing OR a draft-style hedge ("appears",
  // "may", "suggests", "consistent with").
  const hasReviewerHint = REVIEWER_PRESENCE_HINTS.some((re) => re.test(text));
  const hasModeratedHedge =
    /\b(?:appears|may|suggests?|consistent with|seems|indicates?)\b/i.test(text);
  if (!hasReviewerHint && !hasModeratedHedge) {
    failures.push({
      gate: 'reviewer_presence',
      reason:
        'narrative lacks reviewer/interpretation framing or moderated hedges',
    });
  }

  // Gate 7 — institutional dignity (extra patterns beyond prohibited list)
  for (const re of DIGNITY_OFFENDERS) {
    const m = text.match(re);
    if (m) {
      failures.push({
        gate: 'institutional_dignity',
        reason: 'institutional dignity offence',
        evidence: m[0],
      });
    }
  }

  return {
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    prohibitedMatches: prohibited,
  };
}

function collectSignalIds(ctx: NarrativeContext): string[] {
  const ids: string[] = [];
  for (const b of ctx.maturityBands) ids.push(b.pillarId);
  for (const a of ctx.archetypes) ids.push(a.archetypeId);
  for (const b of ctx.breakpoints) ids.push(b.breakpointId);
  for (const s of ctx.structuralSignals) ids.push(s.signalId);
  for (const o of ctx.onboardingFindings) ids.push(o.findingId);
  for (const g of ctx.governanceObservations) ids.push(g.observationId);
  return ids;
}
