/**
 * Stage/transition checks for a rule set's procedure: level count is data, intermediate-level waiver needs a recorded
 * agreement of both parties and is only allowed over waivable levels, a direct route needs a qualifying category, and the
 * same employer decision-maker may not hear the matter at more than one level when the rule set says so.
 */
import type { RuleSet, StageDefinition } from './types';

export interface WaiverAgreement {
  unionPartyRef: string | null;
  employerPartyRef: string | null;
  agreedOnDay: string;
}

export type TransitionDecision =
  | { ok: true; kind: 'escalate' | 'waive_intermediate' | 'direct_route'; skipped: string[] }
  | { ok: false; code: 'unknown_stage' | 'transition_not_defined' | 'level_not_waivable' | 'waiver_agreement_required' | 'not_qualifying' | 'backwards'; message: string };

function stage(rs: RuleSet, key: string): StageDefinition | undefined {
  return rs.stages.find((s) => s.key === key);
}

export function decideStageTransition(
  rs: RuleSet,
  fromKey: string,
  toKey: string,
  ctx: { waiver?: WaiverAgreement | null; matterCategory?: string | null } = {},
): TransitionDecision {
  const from = stage(rs, fromKey);
  const to = stage(rs, toKey);
  if (!from || !to) return { ok: false, code: 'unknown_stage', message: 'Both stages must be defined by the rule set.' };
  if (to.level <= from.level) return { ok: false, code: 'backwards', message: 'A procedure only moves to a higher level.' };
  const skipped = rs.stages.filter((s) => s.level > from.level && s.level < to.level).sort((a, b) => a.level - b.level);
  const defined = rs.transitions.filter((t) => t.from === fromKey && t.to === toKey);
  if (defined.length === 0) return { ok: false, code: 'transition_not_defined', message: `The rule set defines no transition from ${fromKey} to ${toKey}.` };

  if (skipped.length === 0 && defined.some((t) => t.kind === 'escalate')) return { ok: true, kind: 'escalate', skipped: [] };

  const direct = defined.find((t) => t.kind === 'direct_route');
  if (direct) {
    if (direct.qualifyingCategory && ctx.matterCategory === direct.qualifyingCategory) {
      return { ok: true, kind: 'direct_route', skipped: skipped.map((s) => s.key) };
    }
    if (!defined.some((t) => t.kind === 'waive_intermediate')) {
      return { ok: false, code: 'not_qualifying', message: 'The matter is not in the category this direct route is defined for.' };
    }
  }
  if (defined.some((t) => t.kind === 'waive_intermediate')) {
    const notWaivable = skipped.filter((s) => !s.waivable);
    if (notWaivable.length > 0) {
      return { ok: false, code: 'level_not_waivable', message: `Level(s) ${notWaivable.map((s) => s.key).join(', ')} cannot be waived under this rule set.` };
    }
    const w = ctx.waiver;
    if (!w || !w.unionPartyRef || !w.employerPartyRef) {
      return { ok: false, code: 'waiver_agreement_required', message: 'Eliminating a level needs a recorded agreement naming both parties.' };
    }
    return { ok: true, kind: 'waive_intermediate', skipped: skipped.map((s) => s.key) };
  }
  return { ok: false, code: 'transition_not_defined', message: `The rule set defines no transition from ${fromKey} to ${toKey} that skips levels.` };
}

export interface LevelHearing {
  stageKey: string;
  employerDecisionMakerRef: string | null;
}

export interface DecisionMakerConflict {
  decisionMakerRef: string;
  stageKeys: string[];
}

/** The decision-makers who heard (or are proposed to hear) the matter at more than one level. */
export function decisionMakerConflicts(rs: RuleSet, hearings: LevelHearing[]): DecisionMakerConflict[] {
  if (!rs.distinctDecisionMakerPerLevel) return [];
  const byRef = new Map<string, Set<string>>();
  for (const h of hearings) {
    if (!h.employerDecisionMakerRef) continue;
    const set = byRef.get(h.employerDecisionMakerRef) ?? new Set<string>();
    set.add(h.stageKey);
    byRef.set(h.employerDecisionMakerRef, set);
  }
  return [...byRef.entries()]
    .filter(([, stages]) => stages.size > 1)
    .map(([decisionMakerRef, stages]) => ({ decisionMakerRef, stageKeys: [...stages].sort() }))
    .sort((a, b) => (a.decisionMakerRef < b.decisionMakerRef ? -1 : 1));
}
