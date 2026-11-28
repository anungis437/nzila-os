/**
 * Synthetic procedural regimes for tests only. They are invented: no clause, day count, employer or holiday list here is
 * taken from any real agreement or institution.
 */
import type { CalendarPolicy, ClockRule, HolidayCalendarVersion, MatterFacts, RuleSet } from '../types';

export const BUSINESS_DAYS: CalendarPolicy = { mode: 'business_days', weekendDays: [0, 6], holidays: 'excluded', rollForward: 'next_working_day' };
export const CALENDAR_ROLL: CalendarPolicy = { mode: 'calendar_days', weekendDays: [0, 6], holidays: 'excluded', rollForward: 'next_working_day' };
export const CALENDAR_PLAIN: CalendarPolicy = { mode: 'calendar_days', weekendDays: [0, 6], holidays: 'not_applicable', rollForward: 'none' };

const noExtension = { permitted: false, mutualAgreementRequired: true, parentParticipationRequired: false, maxTotalCalendarDays: null };
const mutualExtension = { permitted: true, mutualAgreementRequired: true, parentParticipationRequired: false, maxTotalCalendarDays: 30 };

export function clock(over: Partial<ClockRule> & Pick<ClockRule, 'key'>): ClockRule {
  return {
    kind: 'employer_reply',
    stageKey: 'L1',
    triggerEvent: 'presentation',
    receiptMode: 'occurrence',
    days: 10,
    calendar: BUSINESS_DAYS,
    holidayCalendarKey: 'synthetic-designated',
    pausable: true,
    extension: mutualExtension,
    sourceClause: 'Synthetic Art. 1',
    ...over,
  };
}

export const SYNTHETIC_HOLIDAYS_2027: HolidayCalendarVersion = {
  id: 'hcv-2027-v1',
  calendarKey: 'synthetic-designated',
  version: 1,
  status: 'adopted',
  sourceReference: 'Synthetic Agreement A, Appendix H (invented)',
  coverageFrom: '2027-01-01',
  coverageTo: '2027-12-31',
  days: ['2027-01-01', '2027-04-02', '2027-05-24', '2027-07-01', '2027-09-06', '2027-10-11', '2027-11-11', '2027-12-27', '2027-12-28'],
};

/** Regime A: three levels, the middle one waivable; a direct route to the final level for a qualifying category. */
export function regimeA(over: Partial<RuleSet> = {}): RuleSet {
  return {
    id: 'rs-a-v1',
    key: 'synthetic-a/standard',
    version: 1,
    status: 'adopted',
    origin: 'human_authored',
    source: {
      id: 'src-a',
      kind: 'collective_agreement',
      title: 'Synthetic Agreement A',
      edition: '2026-2029',
      language: 'en',
      reference: 'Synthetic Agreement A, Article 18 (invented)',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      supersedesSourceId: null,
    },
    applicability: { regime: 'synthetic-a', procedureRoute: 'individual', employerIds: ['employer-1'], bargainingGroups: '*', classifications: '*' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    stages: [
      { key: 'L1', level: 1, label: 'First level', waivable: false, isFinal: false },
      { key: 'L2', level: 2, label: 'Intermediate level', waivable: true, isFinal: false },
      { key: 'L3', level: 3, label: 'Final level', waivable: false, isFinal: true },
    ],
    transitions: [
      { from: 'L1', to: 'L2', kind: 'escalate' },
      { from: 'L2', to: 'L3', kind: 'escalate' },
      { from: 'L1', to: 'L3', kind: 'waive_intermediate' },
      { from: 'L1', to: 'L3', kind: 'direct_route', qualifyingCategory: 'termination' },
    ],
    clocks: [
      clock({ key: 'filing', kind: 'filing_limit', stageKey: null, triggerEvent: 'awareness', days: 25, extension: noExtension }),
      clock({ key: 'reply_l1', kind: 'employer_reply', triggerEvent: 'presentation', receiptMode: 'receipt' }),
      clock({ key: 'escalate_l1', kind: 'member_escalation', triggerEvent: 'decision_conveyed', receiptMode: 'receipt' }),
      clock({ key: 'referral', kind: 'referral_limit', stageKey: 'L3', triggerEvent: 'final_response', receiptMode: 'delivery', days: 40, calendar: CALENDAR_ROLL, pausable: false, extension: noExtension }),
    ],
    requiredDeterminations: [],
    distinctDecisionMakerPerLevel: true,
    ...over,
  };
}

/** Regime B: four levels, none waivable, calendar days with no roll-forward (the legacy calendar-day contract). */
export function regimeB(over: Partial<RuleSet> = {}): RuleSet {
  return {
    ...regimeA(),
    id: 'rs-b-v1',
    key: 'synthetic-b/standard',
    source: { ...regimeA().source, id: 'src-b', title: 'Synthetic Agreement B', reference: 'Synthetic Agreement B, Article 9 (invented)' },
    applicability: { regime: 'synthetic-b', procedureRoute: 'individual', employerIds: '*', bargainingGroups: ['group-x'], classifications: '*' },
    stages: [
      { key: 'L1', level: 1, label: 'Level 1', waivable: false, isFinal: false },
      { key: 'L2', level: 2, label: 'Level 2', waivable: false, isFinal: false },
      { key: 'L3', level: 3, label: 'Level 3', waivable: true, isFinal: false },
      { key: 'L4', level: 4, label: 'Level 4', waivable: false, isFinal: true },
    ],
    transitions: [
      { from: 'L1', to: 'L2', kind: 'escalate' },
      { from: 'L2', to: 'L3', kind: 'escalate' },
      { from: 'L3', to: 'L4', kind: 'escalate' },
      { from: 'L1', to: 'L4', kind: 'waive_intermediate' },
    ],
    clocks: [clock({ key: 'reply_l1', days: 40, calendar: CALENDAR_PLAIN, holidayCalendarKey: null })],
    distinctDecisionMakerPerLevel: false,
    ...over,
  };
}

export function matterA(over: Partial<MatterFacts> = {}): MatterFacts {
  return { regime: 'synthetic-a', procedureRoute: 'individual', employerId: 'employer-1', bargainingGroup: 'group-x', classification: 'class-1', determinations: {}, ...over };
}
