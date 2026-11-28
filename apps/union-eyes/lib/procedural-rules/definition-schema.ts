/**
 * Input validation for rule sources, rule set drafts, holiday calendar drafts and grievance procedural facts. Structural
 * validation (zod) plus the cross-references the engine relies on (clock stages exist, transitions name defined stages,
 * keys and levels are unique). A definition that fails here never reaches storage.
 */
import { z } from 'zod';
import { isCalendarDay } from '@/lib/deadline-engine/deadline-day';
import { CLOCK_KINDS, DAY_COUNT_MODES, RECEIPT_MODES, RULE_ORIGINS, RULE_SOURCE_KINDS } from './types';

const day = z.string().refine(isCalendarDay, 'must be a calendar day (YYYY-MM-DD)');
const key = z.string().regex(/^[a-z0-9][a-z0-9_./-]{0,119}$/, 'lower-case key: letters, digits, _ . / -');
/** Stage, clock, event, category and determination identifiers (case-preserving). */
const ident = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_./-]{0,119}$/, 'identifier: letters, digits, _ . / -');
const label = z.string().trim().min(1).max(200);
const scope = z.union([z.literal('*'), z.array(z.string().trim().min(1).max(120)).min(1).max(500)]);

export const RuleSourceInputSchema = z
  .object({
    kind: z.enum(RULE_SOURCE_KINDS),
    title: label,
    edition: z.string().trim().min(1).max(120),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    reference: z.string().trim().min(1).max(500),
    effectiveFrom: day,
    effectiveTo: day.nullable(),
    supersedesSourceId: z.string().uuid().nullable(),
  })
  .strict()
  .refine((s) => s.effectiveTo === null || s.effectiveTo > s.effectiveFrom, 'effectiveTo must be after effectiveFrom');

export const ApplicabilitySchema = z
  .object({
    regime: z.string().trim().min(1).max(120),
    procedureRoute: z.string().trim().min(1).max(120),
    employerIds: scope,
    bargainingGroups: scope,
    classifications: scope,
  })
  .strict();

const CalendarPolicySchema = z
  .object({
    mode: z.enum(DAY_COUNT_MODES),
    weekendDays: z.array(z.number().int().min(0).max(6)).max(6),
    holidays: z.enum(['excluded', 'not_applicable']),
    rollForward: z.enum(['next_working_day', 'none']),
  })
  .strict();

const ClockSchema = z
  .object({
    key: ident,
    kind: z.enum(CLOCK_KINDS),
    stageKey: ident.nullable(),
    triggerEvent: ident,
    receiptMode: z.enum(RECEIPT_MODES),
    deemedReceiptDays: z.number().int().min(0).max(365).optional(),
    days: z.number().int().min(0).max(3650),
    calendar: CalendarPolicySchema,
    holidayCalendarKey: key.nullable(),
    pausable: z.boolean(),
    extension: z
      .object({
        permitted: z.boolean(),
        mutualAgreementRequired: z.boolean(),
        parentParticipationRequired: z.boolean(),
        maxTotalCalendarDays: z.number().int().min(0).max(3650).nullable(),
      })
      .strict(),
    sourceClause: z.string().trim().min(1).max(300),
  })
  .strict()
  .refine((c) => c.calendar.holidays !== 'excluded' || c.holidayCalendarKey !== null, 'a clock that excludes holidays names its holiday calendar')
  .refine((c) => c.receiptMode !== 'deemed_receipt' || c.deemedReceiptDays !== undefined, 'deemed receipt needs deemedReceiptDays');

export const RuleDefinitionSchema = z
  .object({
    stages: z
      .array(z.object({ key: ident, level: z.number().int().min(1).max(20), label, waivable: z.boolean(), isFinal: z.boolean() }).strict())
      .min(1)
      .max(20),
    transitions: z
      .array(
        z
          .object({ from: ident, to: ident, kind: z.enum(['escalate', 'waive_intermediate', 'direct_route']), qualifyingCategory: ident.optional() })
          .strict()
          .refine((t) => t.kind !== 'direct_route' || t.qualifyingCategory !== undefined, 'a direct route names its qualifying category'),
      )
      .max(100),
    clocks: z.array(ClockSchema).min(1).max(100),
    requiredDeterminations: z.array(ident).max(50),
    distinctDecisionMakerPerLevel: z.boolean(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const stageKeys = new Set(d.stages.map((s) => s.key));
    if (stageKeys.size !== d.stages.length) ctx.addIssue({ code: 'custom', message: 'stage keys must be unique' });
    if (new Set(d.stages.map((s) => s.level)).size !== d.stages.length) ctx.addIssue({ code: 'custom', message: 'stage levels must be unique' });
    if (d.stages.filter((s) => s.isFinal).length !== 1) ctx.addIssue({ code: 'custom', message: 'exactly one stage is final' });
    if (new Set(d.clocks.map((c) => c.key)).size !== d.clocks.length) ctx.addIssue({ code: 'custom', message: 'clock keys must be unique' });
    for (const t of d.transitions) {
      if (!stageKeys.has(t.from) || !stageKeys.has(t.to)) ctx.addIssue({ code: 'custom', message: `transition ${t.from} -> ${t.to} names an undefined stage` });
    }
    for (const c of d.clocks) {
      if (c.stageKey !== null && !stageKeys.has(c.stageKey)) ctx.addIssue({ code: 'custom', message: `clock ${c.key} names an undefined stage` });
    }
  });

export const RuleSetDraftInputSchema = z
  .object({
    ruleKey: key,
    sourceId: z.string().uuid(),
    origin: z.enum(RULE_ORIGINS),
    applicability: ApplicabilitySchema,
    effectiveFrom: day,
    effectiveTo: day.nullable(),
    definition: RuleDefinitionSchema,
  })
  .strict()
  .refine((s) => s.effectiveTo === null || s.effectiveTo > s.effectiveFrom, 'effectiveTo must be after effectiveFrom');

export const HolidayCalendarDraftInputSchema = z
  .object({
    calendarKey: key,
    origin: z.enum(RULE_ORIGINS),
    sourceReference: z.string().trim().min(1).max(500),
    coverageFrom: day,
    coverageTo: day,
    days: z.array(day).max(400),
  })
  .strict()
  .refine((c) => c.coverageTo >= c.coverageFrom, 'coverageTo must not precede coverageFrom')
  .refine((c) => c.days.every((d) => d >= c.coverageFrom && d <= c.coverageTo), 'every holiday must fall inside the coverage span')
  .refine((c) => new Set(c.days).size === c.days.length, 'holidays must be unique');

export const LifecycleTransitionInputSchema = z
  .object({ target: z.enum(['reviewed', 'adopted', 'draft', 'superseded', 'retired']), reason: z.string().trim().min(1).max(1000) })
  .strict();

const instant = z.string().datetime({ offset: true });
const ref = z.string().trim().min(1).max(200);

export const ProcedureBindingInputSchema = z
  .object({
    regime: z.string().trim().min(1).max(120).nullable(),
    procedureRoute: z.string().trim().min(1).max(120).nullable(),
    employerRef: ref.nullable(),
    bargainingGroup: ref.nullable(),
    classification: ref.nullable(),
    matterCategory: ident.nullable(),
    referenceDay: day.nullable(),
    determinations: z.record(ident, z.boolean()).default({}),
  })
  .strict();

export const FACT_PAYLOAD_SCHEMAS = {
  trigger: z
    .object({
      event: ident,
      occurredAt: instant.nullable().optional(),
      sentAt: instant.nullable().optional(),
      deliveredAt: instant.nullable().optional(),
      receivedAt: instant.nullable().optional(),
      evidenceRef: ref.nullable().optional(),
    })
    .strict()
    .refine((t) => Boolean(t.occurredAt || t.sentAt || t.deliveredAt || t.receivedAt), 'a trigger records at least one instant'),
  pause: z
    .object({ startDay: day, endDay: day.nullable(), reason: z.string().trim().min(1).max(500), authority: ref })
    .strict()
    .refine((p) => p.endDay === null || p.endDay >= p.startDay, 'a pause cannot end before it starts'),
  extension: z
    .object({
      agreedOnDay: day,
      unionPartyRef: ref.nullable(),
      employerPartyRef: ref.nullable(),
      parentPartyRef: ref.nullable(),
      form: z.string().trim().min(1).max(120),
      newDueDay: day.nullable().optional(),
      additionalDays: z.number().int().positive().max(365).nullable().optional(),
      clockKey: ident,
    })
    .strict(),
  level_hearing: z.object({ stageKey: ident, employerDecisionMakerRef: ref, heardOnDay: day.nullable().optional() }).strict(),
  level_waiver: z.object({ fromStageKey: ident, toStageKey: ident, unionPartyRef: ref, employerPartyRef: ref, agreedOnDay: day }).strict(),
} as const;

export type FactKind = keyof typeof FACT_PAYLOAD_SCHEMAS;
export const FACT_KINDS = Object.keys(FACT_PAYLOAD_SCHEMAS) as FactKind[];
