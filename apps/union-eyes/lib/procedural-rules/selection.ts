/**
 * Rule-set selection: exactly one adopted rule set, effective on the reference day, whose explicit applicability matches the
 * matter. Zero, several, unadopted-only, expired-source or missing-fact outcomes are reviewable exceptions, never a guess.
 */
import type { CalendarDay, MatterFacts, ProceduralException, RuleSet } from './types';

export type SelectionResult =
  | { ok: true; ruleSet: RuleSet; considered: SelectionCandidateTrace[] }
  | { ok: false; exception: ProceduralException; considered: SelectionCandidateTrace[] };

export interface SelectionCandidateTrace {
  ruleSetId: string;
  key: string;
  version: number;
  status: string;
  outcome: 'matched' | 'not_adopted' | 'not_effective' | 'source_expired' | 'not_applicable' | 'missing_fact';
  detail?: string;
}

function effectiveOn(from: CalendarDay, to: CalendarDay | null, day: CalendarDay): boolean {
  return from <= day && (to === null || day < to);
}

type DimensionOutcome = 'match' | 'mismatch' | 'missing';

function dimension(scope: string[] | '*', value: string | null): DimensionOutcome {
  if (scope === '*') return 'match';
  if (value === null || value === '') return 'missing';
  return scope.includes(value) ? 'match' : 'mismatch';
}

/** Does the rule set apply to the matter? `missing` names the first fact the matter lacks that the rule set needs. */
export function applicabilityOf(ruleSet: RuleSet, matter: MatterFacts): { outcome: 'match' | 'mismatch' } | { outcome: 'missing'; fact: string } {
  const a = ruleSet.applicability;
  if (matter.regime === null) return { outcome: 'missing', fact: 'regime' };
  if (matter.procedureRoute === null) return { outcome: 'missing', fact: 'procedureRoute' };
  if (a.regime !== matter.regime || a.procedureRoute !== matter.procedureRoute) return { outcome: 'mismatch' };
  const checks: Array<[string, DimensionOutcome]> = [
    ['employerId', dimension(a.employerIds, matter.employerId)],
    ['bargainingGroup', dimension(a.bargainingGroups, matter.bargainingGroup)],
    ['classification', dimension(a.classifications, matter.classification)],
  ];
  if (checks.some(([, o]) => o === 'mismatch')) return { outcome: 'mismatch' };
  const missing = checks.find(([, o]) => o === 'missing');
  return missing ? { outcome: 'missing', fact: missing[0] } : { outcome: 'match' };
}

export function selectRuleSet(candidates: RuleSet[], matter: MatterFacts, referenceDay: CalendarDay): SelectionResult {
  const considered: SelectionCandidateTrace[] = [];
  const matched: RuleSet[] = [];
  let missingFact: string | null = null;
  let unadoptedApplicable = 0;
  let expiredSource = 0;

  const sorted = [...candidates].sort((x, y) => (x.key === y.key ? x.version - y.version : x.key < y.key ? -1 : 1));
  for (const rs of sorted) {
    const base = { ruleSetId: rs.id, key: rs.key, version: rs.version, status: rs.status };
    const applies = applicabilityOf(rs, matter);
    if (applies.outcome === 'mismatch') {
      considered.push({ ...base, outcome: 'not_applicable' });
      continue;
    }
    if (!effectiveOn(rs.effectiveFrom, rs.effectiveTo, referenceDay)) {
      considered.push({ ...base, outcome: 'not_effective' });
      continue;
    }
    if (applies.outcome === 'missing') {
      missingFact ??= applies.fact;
      considered.push({ ...base, outcome: 'missing_fact', detail: applies.fact });
      continue;
    }
    if (rs.status !== 'adopted') {
      unadoptedApplicable += 1;
      considered.push({ ...base, outcome: 'not_adopted' });
      continue;
    }
    if (!effectiveOn(rs.source.effectiveFrom, rs.source.effectiveTo, referenceDay)) {
      expiredSource += 1;
      considered.push({ ...base, outcome: 'source_expired', detail: rs.source.reference });
      continue;
    }
    matched.push(rs);
    considered.push({ ...base, outcome: 'matched' });
  }

  if (matched.length === 1 && missingFact === null) return { ok: true, ruleSet: matched[0], considered };
  if (matched.length > 1) {
    return {
      ok: false,
      considered,
      exception: {
        code: 'ambiguous_rule_sets',
        message: 'More than one adopted rule set applies to this matter on the reference day; a reviewer must resolve which governs.',
        detail: { ruleSetIds: matched.map((m) => m.id) },
      },
    };
  }
  if (missingFact !== null) {
    return {
      ok: false,
      considered,
      exception: { code: 'missing_matter_fact', message: `The matter does not record ${missingFact}, which rule selection needs.`, detail: { fact: missingFact } },
    };
  }
  if (expiredSource > 0) {
    return { ok: false, considered, exception: { code: 'rule_source_expired', message: 'The only applicable rule set reads from an instrument that is not in force on the reference day.' } };
  }
  if (unadoptedApplicable > 0) {
    return { ok: false, considered, exception: { code: 'rule_set_not_adopted', message: 'An applicable rule set exists but has not been adopted; only adopted rules execute.' } };
  }
  return { ok: false, considered, exception: { code: 'no_applicable_rule_set', message: 'No adopted rule set applies to this matter on the reference day.' } };
}
