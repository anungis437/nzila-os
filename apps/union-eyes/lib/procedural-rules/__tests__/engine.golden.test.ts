/**
 * Golden tests for the procedural deadline engine. Expected days were worked out by hand from a 2027 calendar
 * (2027-03-01 is a Monday; 2027-04-02 and 2027-07-01 are synthetic designated holidays) — not produced by the engine.
 */
import { describe, expect, it } from 'vitest';
import { addCalendarDays, dueAtEndOfDayAfter } from '@/lib/deadline-engine/deadline-day';
import { calculateProceduralDeadline, type ProceduralCalculationInput } from '../engine';
import type { ExtensionRecord, PauseRecord, TriggerFact } from '../types';
import { BUSINESS_DAYS, CALENDAR_PLAIN, CALENDAR_ROLL, SYNTHETIC_HOLIDAYS_2027, clock, matterA, regimeA, regimeB } from './synthetic-regimes';

const TZ = 'America/Toronto';

function input(over: Partial<ProceduralCalculationInput> = {}): ProceduralCalculationInput {
  return {
    ruleSets: [regimeA()],
    holidayCalendars: [SYNTHETIC_HOLIDAYS_2027],
    matter: matterA(),
    referenceDay: '2027-03-01',
    clockKey: 'reply_l1',
    triggers: [{ event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' }],
    pauses: [],
    extensions: [],
    timeZone: TZ,
    ...over,
  };
}

/** Regime A with one replacement clock definition for `reply_l1`. */
function withReplyClock(over: Parameters<typeof clock>[0]) {
  const rs = regimeA();
  return [{ ...rs, clocks: rs.clocks.map((c) => (c.key === 'reply_l1' ? clock({ ...c, ...over }) : c)) }];
}

function due(over: Partial<ProceduralCalculationInput> = {}) {
  const r = calculateProceduralDeadline(input(over));
  if (r.status !== 'computed') throw new Error(`expected a computed deadline, got ${JSON.stringify(r.exceptions)}`);
  return r;
}

function exceptionCode(over: Partial<ProceduralCalculationInput> = {}) {
  const r = calculateProceduralDeadline(input(over));
  if (r.status !== 'exception') throw new Error(`expected an exception, got ${r.dueDay}`);
  return r.exceptions[0].code;
}

describe('business days vs calendar days', () => {
  it('counts 10 business days from Monday 2027-03-01 to Monday 2027-03-15', () => {
    expect(due().dueDay).toBe('2027-03-15');
  });

  it('due at 23:59 local on the due day (EDT after the 2027-03-14 change)', () => {
    expect(due().dueAt).toBe('2027-03-16T03:59:00.000Z');
  });

  it('counts 40 calendar days with no roll-forward exactly as the legacy calendar-day contract (Saturday 2027-04-10)', () => {
    const r = due({ ruleSets: withReplyClock({ key: 'reply_l1', days: 40, calendar: CALENDAR_PLAIN, holidayCalendarKey: null }), holidayCalendars: [] });
    expect(r.dueDay).toBe('2027-04-10');
    expect(r.dueDay).toBe(addCalendarDays('2027-03-01', 40));
    expect(r.dueAt).toBe(dueAtEndOfDayAfter(new Date('2027-03-01T15:00:00Z'), 40, TZ).toISOString());
  });

  it('a calendar-day count landing on a Saturday rolls forward to Monday when the clock says so', () => {
    expect(due({ ruleSets: withReplyClock({ key: 'reply_l1', days: 40, calendar: CALENDAR_ROLL }) }).dueDay).toBe('2027-04-12');
  });

  it('refuses a clock that does not state its day-count mode (no universal default)', () => {
    const broken = withReplyClock({ key: 'reply_l1', calendar: { ...BUSINESS_DAYS, mode: undefined as never } });
    expect(exceptionCode({ ruleSets: broken })).toBe('invalid_clock_definition');
  });
});

describe('holiday exclusion and weekend roll-forward', () => {
  it('skips a designated holiday in a business-day count (2027-03-26 + 10 → 2027-04-12)', () => {
    expect(due({ triggers: [{ event: 'presentation', receivedAt: '2027-03-26T15:00:00Z' }] }).dueDay).toBe('2027-04-12');
  });

  it('rolls a calendar-day count off a holiday (2027-06-01 + 30 = Thursday holiday 07-01 → 07-02)', () => {
    const r = due({ ruleSets: withReplyClock({ key: 'reply_l1', days: 30, calendar: CALENDAR_ROLL }), triggers: [{ event: 'presentation', receivedAt: '2027-06-01T15:00:00Z' }], referenceDay: '2027-06-01' });
    expect(r.dueDay).toBe('2027-07-02');
    expect(r.evidence.trace.counting.filter((t) => t.action === 'rolled_forward')).toEqual([{ day: '2027-07-01', action: 'rolled_forward', why: 'holiday' }]);
  });

  it('rolls across a holiday and then a weekend (2027-03-03 + 30 = Friday holiday 04-02 → Monday 04-05)', () => {
    const r = due({ ruleSets: withReplyClock({ key: 'reply_l1', days: 30, calendar: CALENDAR_ROLL }), triggers: [{ event: 'presentation', receivedAt: '2027-03-03T15:00:00Z' }] });
    expect(r.dueDay).toBe('2027-04-05');
  });

  it('counts a filing limit from awareness across a holiday (25 business days from 2027-03-01 → 2027-04-06)', () => {
    expect(due({ clockKey: 'filing', triggers: [{ event: 'awareness', occurredAt: '2027-03-01T14:00:00Z' }] }).dueDay).toBe('2027-04-06');
  });

  it('records the holiday calendar version and source on the evidence', () => {
    expect(due().evidence.holidayCalendar).toEqual({
      id: 'hcv-2027-v1',
      calendarKey: 'synthetic-designated',
      version: 1,
      sourceReference: SYNTHETIC_HOLIDAYS_2027.sourceReference,
      coverageFrom: '2027-01-01',
      coverageTo: '2027-12-31',
    });
  });

  it('refuses to count past the holiday calendar coverage (2027-12-17 + 10 business days reaches 2028)', () => {
    expect(exceptionCode({ triggers: [{ event: 'presentation', receivedAt: '2027-12-17T15:00:00Z' }] })).toBe('holiday_calendar_coverage_gap');
  });

  it('refuses when no holiday calendar covers the trigger day', () => {
    expect(exceptionCode({ holidayCalendars: [] })).toBe('holiday_calendar_missing');
  });

  it('refuses a holiday calendar that has not been adopted', () => {
    expect(exceptionCode({ holidayCalendars: [{ ...SYNTHETIC_HOLIDAYS_2027, status: 'reviewed' }] })).toBe('holiday_calendar_not_adopted');
  });

  it('refuses two adopted holiday calendar versions covering the same day', () => {
    expect(exceptionCode({ holidayCalendars: [SYNTHETIC_HOLIDAYS_2027, { ...SYNTHETIC_HOLIDAYS_2027, id: 'hcv-2027-v2', version: 2 }] })).toBe('holiday_calendar_ambiguous');
  });
});

describe('pauses (stop-the-clock, abeyance)', () => {
  const pause = (startDay: string, endDay: string | null): PauseRecord => ({ id: `p-${startDay}`, startDay, endDay, reason: 'joint abeyance', authority: 'both parties' });

  it('excludes a paused week from a business-day count (2027-03-01 + 10, paused 03-08..03-12 → 03-22)', () => {
    expect(due({ pauses: [pause('2027-03-08', '2027-03-12')] }).dueDay).toBe('2027-03-22');
  });

  it('excludes paused days from a calendar-day count (40 days, 5 paused → 2027-04-15)', () => {
    const r = due({ ruleSets: withReplyClock({ key: 'reply_l1', days: 40, calendar: CALENDAR_PLAIN, holidayCalendarKey: null }), pauses: [pause('2027-03-10', '2027-03-14')] });
    expect(r.dueDay).toBe('2027-04-15');
  });

  it('ignores a pause that ended on or before the trigger day', () => {
    expect(due({ pauses: [pause('2027-02-01', '2027-03-01')] }).dueDay).toBe('2027-03-15');
  });

  it('an open pause produces no deadline', () => {
    expect(exceptionCode({ pauses: [pause('2027-03-05', null)] })).toBe('clock_paused');
  });

  it('a pause on a clock that does not stop is referred to a reviewer', () => {
    expect(exceptionCode({ ruleSets: withReplyClock({ key: 'reply_l1', pausable: false }), pauses: [pause('2027-03-08', '2027-03-09')] })).toBe('pause_not_permitted');
  });

  it('refuses a pause that ends before it starts', () => {
    expect(exceptionCode({ pauses: [pause('2027-03-09', '2027-03-08')] })).toBe('invalid_pause');
  });
});

describe('mutual extensions', () => {
  const ext = (over: Partial<ExtensionRecord>): ExtensionRecord => ({
    id: 'x1',
    agreedOnDay: '2027-03-10',
    unionPartyRef: 'union-officer-1',
    employerPartyRef: 'employer-rep-1',
    parentPartyRef: null,
    form: 'written',
    additionalDays: 5,
    ...over,
  });

  it('extends by 5 business days from the current due day (03-15 → 03-22)', () => {
    const r = due({ extensions: [ext({})] });
    expect(r.dueDay).toBe('2027-03-22');
    expect(r.evidence.trace.baseDueDay).toBe('2027-03-15');
    expect(r.evidence.trace.extensions).toEqual([{ id: 'x1', fromDay: '2027-03-15', toDay: '2027-03-22' }]);
  });

  it('accepts an agreed new due day', () => {
    expect(due({ extensions: [ext({ additionalDays: null, newDueDay: '2027-03-31' })] }).dueDay).toBe('2027-03-31');
  });

  it('refuses an extension agreed after the deadline passed', () => {
    expect(exceptionCode({ extensions: [ext({ agreedOnDay: '2027-03-16' })] })).toBe('extension_after_expiry');
  });

  it('refuses a mutual extension that does not name the employer party', () => {
    expect(exceptionCode({ extensions: [ext({ employerPartyRef: null })] })).toBe('extension_party_missing');
  });

  it('requires the affiliated parent where the rule says so', () => {
    const rules = withReplyClock({ key: 'reply_l1', extension: { permitted: true, mutualAgreementRequired: true, parentParticipationRequired: true, maxTotalCalendarDays: null } });
    const r = calculateProceduralDeadline(input({ ruleSets: rules, extensions: [ext({})] }));
    expect(r.status === 'exception' && r.exceptions[0].detail).toEqual({ extensionId: 'x1', missingParties: ['affiliated_parent'] });
    expect(due({ ruleSets: rules, extensions: [ext({ parentPartyRef: 'parent-officer-1' })] }).dueDay).toBe('2027-03-22');
  });

  it('refuses extensions beyond the maximum', () => {
    expect(exceptionCode({ extensions: [ext({ additionalDays: null, newDueDay: '2027-04-30' })] })).toBe('extension_exceeds_maximum');
  });

  it('refuses an extension on a clock that does not permit one', () => {
    expect(exceptionCode({ clockKey: 'filing', triggers: [{ event: 'awareness', occurredAt: '2027-03-01T14:00:00Z' }], extensions: [ext({})] })).toBe('extension_not_permitted');
  });

  it('refuses an extension naming both a new day and additional days', () => {
    expect(exceptionCode({ extensions: [ext({ newDueDay: '2027-03-31' })] })).toBe('extension_invalid');
  });
});

describe('receipt modes', () => {
  const letter: TriggerFact = { event: 'decision_conveyed', sentAt: '2027-03-01T15:00:00Z', deliveredAt: '2027-03-03T15:00:00Z', receivedAt: '2027-03-05T15:00:00Z' };
  const escalation = (receiptMode: 'postmark' | 'delivery' | 'receipt' | 'deemed_receipt', extra: object = {}) => {
    const rs = regimeA();
    return [{ ...rs, clocks: rs.clocks.map((c) => (c.key === 'escalate_l1' ? { ...c, receiptMode, ...extra } : c)) }];
  };

  it.each([
    ['postmark', '2027-03-15'],
    ['delivery', '2027-03-17'],
    ['receipt', '2027-03-19'],
  ] as const)('%s → %s', (mode, expected) => {
    expect(due({ clockKey: 'escalate_l1', triggers: [letter], ruleSets: escalation(mode) }).dueDay).toBe(expected);
  });

  it('deemed receipt 5 days after postmark (Saturday 03-06) → 03-19', () => {
    expect(due({ clockKey: 'escalate_l1', triggers: [letter], ruleSets: escalation('deemed_receipt', { deemedReceiptDays: 5 }) }).dueDay).toBe('2027-03-19');
  });

  it('refuses when the instant the clock needs is not recorded', () => {
    expect(exceptionCode({ clockKey: 'escalate_l1', triggers: [{ ...letter, receivedAt: null }] })).toBe('missing_trigger_instant');
  });

  it('reads the trigger day in the organization zone (22:00 Toronto on 03-01 is 03-02 UTC)', () => {
    const late = [{ event: 'presentation', receivedAt: '2027-03-02T03:00:00Z' }];
    expect(due({ triggers: late }).dueDay).toBe('2027-03-15');
    expect(due({ triggers: late, timeZone: 'UTC' }).dueDay).toBe('2027-03-16');
  });

  it('never substitutes the incident date for an awareness trigger', () => {
    expect(exceptionCode({ clockKey: 'filing', triggers: [{ event: 'incident', occurredAt: '2027-02-01T14:00:00Z' }] })).toBe('missing_trigger');
  });

  it('refuses two recorded events of the trigger type', () => {
    expect(exceptionCode({ triggers: [{ event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' }, { event: 'presentation', receivedAt: '2027-03-02T15:00:00Z' }] })).toBe('ambiguous_trigger');
  });

  it('a referral period counts calendar days from delivery of the final response and rolls a weekend forward', () => {
    const r = due({ clockKey: 'referral', triggers: [{ event: 'final_response', deliveredAt: '2027-03-01T15:00:00Z' }] });
    expect(r.dueDay).toBe('2027-04-12');
    expect(r.evidence.clock?.kind).toBe('referral_limit');
  });
});

describe('rule selection and applicability', () => {
  it('no adopted rule set → exception, never a date', () => {
    expect(exceptionCode({ ruleSets: [] })).toBe('no_applicable_rule_set');
  });

  it('an applicable reviewed-but-unadopted rule set does not execute', () => {
    expect(exceptionCode({ ruleSets: [regimeA({ status: 'reviewed' })] })).toBe('rule_set_not_adopted');
  });

  it('an AI-assisted draft does not execute', () => {
    expect(exceptionCode({ ruleSets: [regimeA({ status: 'draft', origin: 'ai_assisted_extraction' })] })).toBe('rule_set_not_adopted');
  });

  it('two adopted rule sets applying to the same matter → ambiguous', () => {
    expect(exceptionCode({ ruleSets: [regimeA(), regimeA({ id: 'rs-a-dup', key: 'synthetic-a/dup' })] })).toBe('ambiguous_rule_sets');
  });

  it("an article scoped to one employer is not applied to another employer's members", () => {
    expect(exceptionCode({ matter: matterA({ employerId: 'employer-2' }) })).toBe('no_applicable_rule_set');
  });

  it('a rule set constrained by bargaining group needs that fact recorded', () => {
    expect(exceptionCode({ ruleSets: [regimeB()], matter: matterA({ regime: 'synthetic-b', bargainingGroup: null }) })).toBe('missing_matter_fact');
  });

  it('selects the rule version effective on the reference day', () => {
    const v1 = regimeA({ effectiveTo: '2027-06-01' });
    const v2 = regimeA({ id: 'rs-a-v2', version: 2, effectiveFrom: '2027-06-01', clocks: regimeA().clocks.map((c) => (c.key === 'reply_l1' ? { ...c, days: 15 } : c)) });
    expect(due({ ruleSets: [v1, v2] }).evidence.ruleSet?.id).toBe('rs-a-v1');
    const later = due({ ruleSets: [v1, v2], referenceDay: '2027-06-15', triggers: [{ event: 'presentation', receivedAt: '2027-06-15T15:00:00Z' }] });
    expect(later.evidence.ruleSet?.id).toBe('rs-a-v2');
    // 15 business days from Tuesday 2027-06-15, skipping the 07-01 holiday: 06-16..06-18 (3), 21..25 (8), 28..30 (11), 07-02 (12), 05..07 (15).
    expect(later.dueDay).toBe('2027-07-07');
  });

  it('refuses a rule set read from an expired side letter', () => {
    const rs = regimeA({ source: { ...regimeA().source, kind: 'side_letter', effectiveTo: '2027-02-01' } });
    expect(exceptionCode({ ruleSets: [rs] })).toBe('rule_source_expired');
  });

  it('a required human determination (e.g. statutory exclusion reviewed) must be recorded first', () => {
    const rs = regimeA({ requiredDeterminations: ['statutory_exclusion_reviewed'] });
    expect(exceptionCode({ ruleSets: [rs] })).toBe('determination_required');
    expect(due({ ruleSets: [rs], matter: matterA({ determinations: { statutory_exclusion_reviewed: true } }) }).dueDay).toBe('2027-03-15');
  });

  it('a missing reference day is an exception', () => {
    expect(exceptionCode({ referenceDay: null })).toBe('missing_reference_day');
  });

  it('an unknown clock is an exception', () => {
    expect(exceptionCode({ clockKey: 'nope' })).toBe('clock_not_defined');
  });

  it('an unknown time zone is an exception', () => {
    expect(exceptionCode({ timeZone: 'Mars/Olympus' })).toBe('invalid_time_zone');
  });
});

describe('determinism and evidence', () => {
  it('the same inputs give the same result and digest, whatever order pauses and extensions arrive in', () => {
    const pauses: PauseRecord[] = [
      { id: 'a', startDay: '2027-03-08', endDay: '2027-03-09', reason: 'r', authority: 'x' },
      { id: 'b', startDay: '2027-03-11', endDay: '2027-03-11', reason: 'r', authority: 'x' },
    ];
    const one = due({ pauses });
    const two = due({ pauses: [...pauses].reverse() });
    expect(two).toEqual(one);
    expect(one.evidence.evidenceDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a different input gives a different digest', () => {
    expect(due().evidence.evidenceDigest).not.toBe(due({ triggers: [{ event: 'presentation', receivedAt: '2027-03-02T15:00:00Z' }] }).evidence.evidenceDigest);
  });

  it('carries the rule set version, source, clock, inputs and trace', () => {
    const e = due().evidence;
    expect(e.engineVersion).toBe('procedural-engine/1');
    expect(e.ruleSet).toMatchObject({ id: 'rs-a-v1', version: 1, status: 'adopted', source: { edition: '2026-2029', language: 'en' } });
    expect(e.clock?.key).toBe('reply_l1');
    expect(e.inputs.triggerDay).toBe('2027-03-01');
    expect(e.trace.counting.filter((t) => t.action === 'counted')).toHaveLength(10);
    expect(e.selection).toEqual([{ ruleSetId: 'rs-a-v1', key: 'synthetic-a/standard', version: 1, status: 'adopted', outcome: 'matched' }]);
  });

  it('an exception still carries the selection trace for the reviewer', () => {
    const r = calculateProceduralDeadline(input({ ruleSets: [regimeA({ status: 'draft' })] }));
    expect(r.status).toBe('exception');
    expect(r.evidence.selection[0].outcome).toBe('not_adopted');
    expect(r.evidence.evidenceDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('business-day policy edge cases', () => {
  it('a business-day count never lands on a weekend even without roll-forward', () => {
    const rules = withReplyClock({ key: 'reply_l1', days: 5, calendar: { ...BUSINESS_DAYS, rollForward: 'none' } });
    expect(due({ ruleSets: rules, triggers: [{ event: 'presentation', receivedAt: '2027-03-05T15:00:00Z' }] }).dueDay).toBe('2027-03-12');
  });

  it('refuses a policy that makes every day a weekend', () => {
    expect(exceptionCode({ ruleSets: withReplyClock({ key: 'reply_l1', calendar: { ...BUSINESS_DAYS, weekendDays: [0, 1, 2, 3, 4, 5, 6] } }) })).toBe('invalid_clock_definition');
  });
});
