/**
 * Procedural deadline calculation. Pure and deterministic: the same inputs give the same output and the same digest, with
 * no clock, no database and no randomness. Every computed deadline carries its evidence (rule set version and source,
 * clock definition, holiday calendar version, inputs and the day-by-day trace). Anything uncertain — no or several
 * applicable rule sets, an unadopted rule or calendar, a missing fact, trigger or determination, an open pause, a
 * malformed extension — yields a reviewable exception and no date.
 */
import { createHash } from 'node:crypto';
import { addCalendarDays, calendarDayInZone, endOfDayInZone, isCalendarDay, isKnownTimeZone } from '@/lib/deadline-engine/deadline-day';
import { calendarDaysBetween, countDays, type CountTraceEntry } from './day-counting';
import { selectRuleSet, type SelectionCandidateTrace } from './selection';
import {
  DAY_COUNT_MODES,
  type CalendarDay,
  type ClockRule,
  type ExtensionRecord,
  type HolidayCalendarVersion,
  type MatterFacts,
  type PauseRecord,
  type ProceduralException,
  type RuleSet,
  type TriggerFact,
} from './types';

export const PROCEDURAL_ENGINE_VERSION = 'procedural-engine/1';

export interface ProceduralCalculationInput {
  ruleSets: RuleSet[];
  holidayCalendars: HolidayCalendarVersion[];
  matter: MatterFacts;
  /** The day that fixes which rule version governs the matter (e.g. the day the matter arose). */
  referenceDay: CalendarDay | null;
  clockKey: string;
  triggers: TriggerFact[];
  pauses: PauseRecord[];
  extensions: ExtensionRecord[];
  timeZone: string;
}

export interface ProceduralEvidence {
  engineVersion: string;
  evidenceDigest: string;
  ruleSet: { id: string; key: string; version: number; status: string; source: RuleSet['source'] } | null;
  clock: ClockRule | null;
  holidayCalendar: { id: string; calendarKey: string; version: number; sourceReference: string; coverageFrom: string; coverageTo: string } | null;
  inputs: {
    matter: MatterFacts;
    referenceDay: CalendarDay | null;
    clockKey: string;
    trigger: TriggerFact | null;
    triggerInstant: string | null;
    triggerDay: CalendarDay | null;
    pauses: PauseRecord[];
    extensions: ExtensionRecord[];
    timeZone: string;
  };
  selection: SelectionCandidateTrace[];
  trace: {
    counting: CountTraceEntry[];
    baseDueDay: CalendarDay | null;
    extensions: Array<{ id: string; fromDay: CalendarDay; toDay: CalendarDay }>;
  };
}

export type ProceduralCalculationResult =
  | { status: 'computed'; dueDay: CalendarDay; dueAt: string; evidence: ProceduralEvidence }
  | { status: 'exception'; exceptions: ProceduralException[]; evidence: ProceduralEvidence };

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

export function digestOf(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function clockDefinitionProblem(clock: ClockRule): string | null {
  if (!Number.isInteger(clock.days) || clock.days < 0) return 'days must be a non-negative whole number';
  if (!clock.calendar || !DAY_COUNT_MODES.includes(clock.calendar.mode)) return 'the clock names no day-count mode';
  if (!Array.isArray(clock.calendar.weekendDays) || clock.calendar.weekendDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return 'weekend days must be 0 (Sunday) to 6 (Saturday)';
  }
  if (new Set(clock.calendar.weekendDays).size >= 7) return 'a policy cannot make every day a weekend day';
  if (clock.calendar.holidays !== 'excluded' && clock.calendar.holidays !== 'not_applicable') return 'holiday treatment is not stated';
  if (clock.calendar.rollForward !== 'next_working_day' && clock.calendar.rollForward !== 'none') return 'roll-forward treatment is not stated';
  if (clock.calendar.holidays === 'excluded' && !clock.holidayCalendarKey) return 'holidays are excluded but no holiday calendar is named';
  if (clock.receiptMode === 'deemed_receipt' && (!Number.isInteger(clock.deemedReceiptDays) || (clock.deemedReceiptDays ?? -1) < 0)) {
    return 'deemed receipt needs a non-negative whole number of days';
  }
  return null;
}

function triggerInstant(fact: TriggerFact, clock: ClockRule): { instant: string | null; deemedDays: number } {
  switch (clock.receiptMode) {
    case 'occurrence':
      return { instant: fact.occurredAt ?? null, deemedDays: 0 };
    case 'postmark':
      return { instant: fact.sentAt ?? null, deemedDays: 0 };
    case 'delivery':
      return { instant: fact.deliveredAt ?? null, deemedDays: 0 };
    case 'receipt':
      return { instant: fact.receivedAt ?? null, deemedDays: 0 };
    case 'deemed_receipt':
      return { instant: fact.sentAt ?? null, deemedDays: clock.deemedReceiptDays ?? 0 };
  }
}

export function calculateProceduralDeadline(input: ProceduralCalculationInput): ProceduralCalculationResult {
  const pauses = [...input.pauses].sort((a, b) => (a.startDay < b.startDay ? -1 : a.startDay > b.startDay ? 1 : a.id < b.id ? -1 : 1));
  const extensions = [...input.extensions].sort((a, b) =>
    a.agreedOnDay < b.agreedOnDay ? -1 : a.agreedOnDay > b.agreedOnDay ? 1 : a.id < b.id ? -1 : 1,
  );
  const evidence: ProceduralEvidence = {
    engineVersion: PROCEDURAL_ENGINE_VERSION,
    evidenceDigest: '',
    ruleSet: null,
    clock: null,
    holidayCalendar: null,
    inputs: {
      matter: input.matter,
      referenceDay: input.referenceDay,
      clockKey: input.clockKey,
      trigger: null,
      triggerInstant: null,
      triggerDay: null,
      pauses,
      extensions,
      timeZone: input.timeZone,
    },
    selection: [],
    trace: { counting: [], baseDueDay: null, extensions: [] },
  };
  const fail = (code: ProceduralException['code'], message: string, detail?: Record<string, unknown>): ProceduralCalculationResult => {
    evidence.evidenceDigest = digestOf({ ...evidence, evidenceDigest: undefined });
    return { status: 'exception', exceptions: [{ code, message, ...(detail ? { detail } : {}) }], evidence };
  };

  if (!isKnownTimeZone(input.timeZone)) return fail('invalid_time_zone', 'The organization time zone is not a known IANA zone.');
  if (!input.referenceDay || !isCalendarDay(input.referenceDay)) {
    return fail('missing_reference_day', 'The matter records no day that fixes which rule version governs it.');
  }

  const selected = selectRuleSet(input.ruleSets, input.matter, input.referenceDay);
  evidence.selection = selected.considered;
  if (!selected.ok) return fail(selected.exception.code, selected.exception.message, selected.exception.detail);
  const rs = selected.ruleSet;
  evidence.ruleSet = { id: rs.id, key: rs.key, version: rs.version, status: rs.status, source: rs.source };

  const missingDeterminations = rs.requiredDeterminations.filter((d) => input.matter.determinations[d] !== true);
  if (missingDeterminations.length > 0) {
    return fail('determination_required', 'A human determination the rule set requires has not been recorded on the matter.', {
      determinations: missingDeterminations,
    });
  }

  const clock = rs.clocks.find((c) => c.key === input.clockKey);
  if (!clock) return fail('clock_not_defined', `The governing rule set defines no clock "${input.clockKey}".`);
  evidence.clock = clock;
  const problem = clockDefinitionProblem(clock);
  if (problem) return fail('invalid_clock_definition', `The clock definition is not usable: ${problem}.`);

  const facts = input.triggers.filter((t) => t.event === clock.triggerEvent);
  if (facts.length === 0) return fail('missing_trigger', `No "${clock.triggerEvent}" event is recorded on the matter.`, { event: clock.triggerEvent });
  if (facts.length > 1) return fail('ambiguous_trigger', `More than one "${clock.triggerEvent}" event is recorded on the matter.`, { event: clock.triggerEvent });
  const fact = facts[0];
  evidence.inputs.trigger = fact;
  const { instant, deemedDays } = triggerInstant(fact, clock);
  if (!instant || Number.isNaN(new Date(instant).getTime())) {
    return fail('missing_trigger_instant', `The "${clock.triggerEvent}" event does not record the ${clock.receiptMode} instant this clock counts from.`, {
      receiptMode: clock.receiptMode,
    });
  }
  evidence.inputs.triggerInstant = new Date(instant).toISOString();
  const triggerDay = addCalendarDays(calendarDayInZone(new Date(instant), input.timeZone), deemedDays);
  evidence.inputs.triggerDay = triggerDay;

  let holidays: HolidayCalendarVersion | null = null;
  if (clock.calendar.holidays === 'excluded') {
    const sameKey = input.holidayCalendars.filter((h) => h.calendarKey === clock.holidayCalendarKey);
    const covering = sameKey.filter((h) => h.coverageFrom <= triggerDay && triggerDay <= h.coverageTo);
    const adopted = covering.filter((h) => h.status === 'adopted');
    if (adopted.length > 1) return fail('holiday_calendar_ambiguous', 'More than one adopted holiday calendar version covers the trigger day.');
    if (adopted.length === 0) {
      return covering.length > 0
        ? fail('holiday_calendar_not_adopted', 'The holiday calendar covering the trigger day has not been adopted.')
        : fail('holiday_calendar_missing', `No holiday calendar "${clock.holidayCalendarKey}" covers the trigger day.`);
    }
    holidays = adopted[0];
    evidence.holidayCalendar = {
      id: holidays.id,
      calendarKey: holidays.calendarKey,
      version: holidays.version,
      sourceReference: holidays.sourceReference,
      coverageFrom: holidays.coverageFrom,
      coverageTo: holidays.coverageTo,
    };
  }

  for (const p of pauses) {
    if (!isCalendarDay(p.startDay) || (p.endDay !== null && (!isCalendarDay(p.endDay) || p.endDay < p.startDay))) {
      return fail('invalid_pause', 'A recorded pause has an invalid interval.', { pauseId: p.id });
    }
  }
  const relevantPauses = pauses.filter((p) => p.endDay === null || p.endDay > triggerDay);
  if (relevantPauses.length > 0 && !clock.pausable) {
    return fail('pause_not_permitted', 'A pause is recorded but the governing clock does not stop; a reviewer must decide its effect.', {
      pauseIds: relevantPauses.map((p) => p.id),
    });
  }

  const ctx = { policy: clock.calendar, holidays, pauses: relevantPauses };
  const base = countDays(triggerDay, clock.days, ctx);
  if (!base.ok) {
    evidence.trace.counting = base.trace;
    if (base.reason === 'open_pause') return fail('clock_paused', 'The clock is paused with no recorded end; no deadline runs until the pause ends.', { day: base.day });
    if (base.reason === 'coverage_gap') return fail('holiday_calendar_coverage_gap', 'The count reaches a day the holiday calendar version does not cover.', { day: base.day });
    return fail('invalid_clock_definition', 'The count did not terminate under the clock definition.');
  }
  evidence.trace.counting = base.trace;
  evidence.trace.baseDueDay = base.dueDay;

  let due = base.dueDay;
  for (const ext of extensions) {
    if (!clock.extension.permitted) return fail('extension_not_permitted', 'The governing clock does not permit extension.', { extensionId: ext.id });
    if (!isCalendarDay(ext.agreedOnDay)) return fail('extension_invalid', 'The extension has no valid agreement day.', { extensionId: ext.id });
    const missingParties = [
      !ext.unionPartyRef ? 'union' : null,
      clock.extension.mutualAgreementRequired && !ext.employerPartyRef ? 'employer' : null,
      clock.extension.parentParticipationRequired && !ext.parentPartyRef ? 'affiliated_parent' : null,
    ].filter((v): v is string => v !== null);
    if (missingParties.length > 0) return fail('extension_party_missing', 'The extension does not record every party the rule requires.', { extensionId: ext.id, missingParties });
    if (ext.agreedOnDay > due) return fail('extension_after_expiry', 'The extension was agreed after the deadline had already passed.', { extensionId: ext.id, dueDay: due });
    const hasDay = typeof ext.newDueDay === 'string';
    const hasDays = typeof ext.additionalDays === 'number';
    if (hasDay === hasDays) return fail('extension_invalid', 'An extension names either a new due day or a number of additional days, not both or neither.', { extensionId: ext.id });
    let next: CalendarDay;
    if (hasDay) {
      if (!isCalendarDay(ext.newDueDay!) || ext.newDueDay! <= due) return fail('extension_invalid', 'The new due day must be a day after the current one.', { extensionId: ext.id });
      next = ext.newDueDay!;
    } else {
      if (!Number.isInteger(ext.additionalDays) || ext.additionalDays! <= 0) return fail('extension_invalid', 'Additional days must be a positive whole number.', { extensionId: ext.id });
      const extended = countDays(due, ext.additionalDays!, ctx);
      if (!extended.ok) {
        return extended.reason === 'coverage_gap'
          ? fail('holiday_calendar_coverage_gap', 'The extension reaches a day the holiday calendar version does not cover.', { day: extended.day })
          : fail('clock_paused', 'The extension runs into an open pause.', { day: extended.day });
      }
      next = extended.dueDay;
    }
    evidence.trace.extensions.push({ id: ext.id, fromDay: due, toDay: next });
    due = next;
  }
  const maxTotal = clock.extension.maxTotalCalendarDays;
  if (maxTotal !== null && calendarDaysBetween(base.dueDay, due) > maxTotal) {
    return fail('extension_exceeds_maximum', 'The extensions together exceed the maximum the rule allows.', { maxTotalCalendarDays: maxTotal });
  }

  const dueAt = endOfDayInZone(due, input.timeZone).toISOString();
  evidence.evidenceDigest = digestOf({ ...evidence, evidenceDigest: undefined });
  return { status: 'computed', dueDay: due, dueAt, evidence };
}
