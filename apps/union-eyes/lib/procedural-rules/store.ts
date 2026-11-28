/**
 * Procedural rule administration: rule sources, versioned rule sets, versioned holiday calendars and their adoption lifecycle.
 * Tables from platform migration 0090 (RLS scoped 0063). Every statement runs on the tenant runtime identity inside
 * withRLSContext for the caller's organization; every write appends a lifecycle event and a canonical audit record in the same
 * transaction. Nothing is deleted: a change after review is a new version, a closed version stays as history.
 *
 * Who may call which function is decided by the routes (role floors); this module enforces the lifecycle itself (independent
 * review and adoption, human actors only, frozen content), which the database enforces again by CHECK and trigger.
 */
import { sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { digestOf } from './engine';
import { decideLifecycleTransition, type LifecycleActor } from './lifecycle';
import type { z } from 'zod';
import type { HolidayCalendarDraftInputSchema, RuleSetDraftInputSchema, RuleSourceInputSchema } from './definition-schema';
import type { HolidayCalendarVersion, RuleLifecycleStatus, RuleOrigin, RuleSet, RuleSourceRef } from './types';

export type RuleSourceInput = z.infer<typeof RuleSourceInputSchema>;
export type RuleSetDraftInput = z.infer<typeof RuleSetDraftInputSchema>;
export type HolidayCalendarDraftInput = z.infer<typeof HolidayCalendarDraftInputSchema>;

/** postgres-js returns row arrays; other drivers wrap them in { rows }. */
export async function queryRows<T>(tx: RLSTx, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = (await tx.execute(query)) as unknown;
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}

const dayText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

interface SourceRow {
  id: string;
  source_kind: RuleSourceRef['kind'];
  title: string;
  edition: string;
  language: string;
  reference: string;
  effective_from: unknown;
  effective_to: unknown;
  supersedes_source_id: string | null;
}

function toSource(row: SourceRow): RuleSourceRef {
  return {
    id: row.id,
    kind: row.source_kind,
    title: row.title,
    edition: row.edition,
    language: row.language,
    reference: row.reference,
    effectiveFrom: dayText(row.effective_from)!,
    effectiveTo: dayText(row.effective_to),
    supersedesSourceId: row.supersedes_source_id,
  };
}

interface RuleSetRow {
  id: string;
  rule_key: string;
  version: number;
  status: RuleLifecycleStatus;
  origin: RuleOrigin;
  applicability: RuleSet['applicability'];
  effective_from: unknown;
  effective_to: unknown;
  definition: Pick<RuleSet, 'stages' | 'transitions' | 'clocks' | 'requiredDeterminations' | 'distinctDecisionMakerPerLevel'>;
  content_digest: string;
  drafted_by: string;
  reviewed_by: string | null;
  adopted_by: string | null;
}

export interface StoredRuleSet extends RuleSet {
  contentDigest: string;
  draftedBy: string;
  reviewedBy: string | null;
  adoptedBy: string | null;
}

function toRuleSet(row: RuleSetRow & { source: SourceRow }): StoredRuleSet {
  return {
    id: row.id,
    key: row.rule_key,
    version: Number(row.version),
    status: row.status,
    origin: row.origin,
    source: toSource(row.source),
    applicability: row.applicability,
    effectiveFrom: dayText(row.effective_from)!,
    effectiveTo: dayText(row.effective_to),
    ...row.definition,
    contentDigest: row.content_digest,
    draftedBy: row.drafted_by,
    reviewedBy: row.reviewed_by,
    adoptedBy: row.adopted_by,
  };
}

interface CalendarRow {
  id: string;
  calendar_key: string;
  version: number;
  status: RuleLifecycleStatus;
  origin: RuleOrigin;
  source_reference: string;
  coverage_from: unknown;
  coverage_to: unknown;
  days: unknown[] | string;
  content_digest: string;
  drafted_by: string;
}

function parseDays(days: unknown[] | string): string[] {
  if (Array.isArray(days)) return days.map((d) => dayText(d)!).sort();
  // A driver that returns the array literal: {2027-01-01,2027-04-02}
  return String(days).replace(/[{}]/g, '').split(',').filter(Boolean).map((d) => d.trim()).sort();
}

export interface StoredHolidayCalendar extends HolidayCalendarVersion {
  origin: RuleOrigin;
  contentDigest: string;
  draftedBy: string;
}

function toCalendar(row: CalendarRow): StoredHolidayCalendar {
  return {
    id: row.id,
    calendarKey: row.calendar_key,
    version: Number(row.version),
    status: row.status,
    origin: row.origin,
    sourceReference: row.source_reference,
    coverageFrom: dayText(row.coverage_from)!,
    coverageTo: dayText(row.coverage_to)!,
    days: parseDays(row.days),
    contentDigest: row.content_digest,
    draftedBy: row.drafted_by,
  };
}

const RULE_SET_SELECT = sql`SELECT rs.*, to_jsonb(src.*) AS source FROM procedural_rule_sets rs JOIN procedural_rule_sources src ON src.id = rs.source_id AND src.organization_id = rs.organization_id`;

async function audit(tx: RLSTx, organizationId: string, userId: string, action: string, resourceType: string, resourceId: string, details: Record<string, unknown>) {
  await persistAtomicAudit(tx, { organizationId, userId, action, resourceType, resourceId, details });
}

async function lifecycleEvent(tx: RLSTx, organizationId: string, subjectType: 'rule_set' | 'holiday_calendar', subjectId: string, from: string | null, to: string, actorId: string, reason: string | null) {
  await tx.execute(sql`INSERT INTO procedural_rule_lifecycle_events (organization_id, subject_type, subject_id, from_status, to_status, actor_id, reason)
    VALUES (${organizationId}::uuid, ${subjectType}, ${subjectId}::uuid, ${from}, ${to}, ${actorId}, ${reason})`);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Sources

export async function createRuleSource(organizationId: string, actorId: string, input: RuleSourceInput): Promise<RuleSourceRef> {
  return withRLSContext({ organizationId }, async (tx) => {
    if (input.supersedesSourceId) {
      const prior = await queryRows<{ id: string }>(tx, sql`SELECT id FROM procedural_rule_sources WHERE id = ${input.supersedesSourceId}::uuid AND organization_id = ${organizationId}::uuid`);
      if (!prior[0]) throw ApiError.notFound('Superseded rule source');
    }
    const [row] = await queryRows<SourceRow>(tx, sql`INSERT INTO procedural_rule_sources
      (organization_id, source_kind, title, edition, language, reference, effective_from, effective_to, supersedes_source_id, created_by)
      VALUES (${organizationId}::uuid, ${input.kind}, ${input.title}, ${input.edition}, ${input.language}, ${input.reference},
        ${input.effectiveFrom}::date, ${input.effectiveTo}::date, ${input.supersedesSourceId}::uuid, ${actorId})
      RETURNING *`);
    await audit(tx, organizationId, actorId, 'procedural_rule_source.create', 'procedural_rule_sources', row.id, { kind: input.kind, edition: input.edition, language: input.language });
    return toSource(row);
  });
}

export async function listRuleSources(organizationId: string): Promise<RuleSourceRef[]> {
  return withRLSContext({ organizationId }, async (tx) =>
    (await queryRows<SourceRow>(tx, sql`SELECT * FROM procedural_rule_sources WHERE organization_id = ${organizationId}::uuid ORDER BY effective_from DESC, title`)).map(toSource),
  );
}

// ---------------------------------------------------------------------------------------------------------------------------
// Rule sets

export function ruleSetContentDigest(input: RuleSetDraftInput): string {
  return digestOf({ sourceId: input.sourceId, applicability: input.applicability, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, definition: input.definition });
}

/** Creates the next version of a rule set as a draft — whatever its origin, an AI-assisted extraction included. */
export async function createRuleSetDraft(organizationId: string, actorId: string, input: RuleSetDraftInput): Promise<StoredRuleSet> {
  return withRLSContext({ organizationId }, async (tx) => {
    const source = await queryRows<{ id: string }>(tx, sql`SELECT id FROM procedural_rule_sources WHERE id = ${input.sourceId}::uuid AND organization_id = ${organizationId}::uuid`);
    if (!source[0]) throw ApiError.notFound('Rule source');
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('procedural_rule_sets:' || ${organizationId} || ':' || ${input.ruleKey}))`);
    const [{ next }] = await queryRows<{ next: number }>(tx, sql`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM procedural_rule_sets
      WHERE organization_id = ${organizationId}::uuid AND rule_key = ${input.ruleKey}`);
    const digest = ruleSetContentDigest(input);
    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO procedural_rule_sets
      (organization_id, rule_key, version, status, origin, source_id, regime, procedure_route, applicability, effective_from, effective_to, definition, content_digest, drafted_by)
      VALUES (${organizationId}::uuid, ${input.ruleKey}, ${Number(next)}, 'draft', ${input.origin}, ${input.sourceId}::uuid,
        ${input.applicability.regime}, ${input.applicability.procedureRoute}, ${JSON.stringify(input.applicability)}::jsonb,
        ${input.effectiveFrom}::date, ${input.effectiveTo}::date, ${JSON.stringify(input.definition)}::jsonb, ${digest}, ${actorId})
      RETURNING id`);
    await lifecycleEvent(tx, organizationId, 'rule_set', row.id, null, 'draft', actorId, input.origin === 'ai_assisted_extraction' ? 'AI-assisted extraction recorded as a draft only' : null);
    await audit(tx, organizationId, actorId, 'procedural_rule_set.draft', 'procedural_rule_sets', row.id, { ruleKey: input.ruleKey, version: Number(next), origin: input.origin, contentDigest: digest });
    return (await getRuleSetIn(tx, organizationId, row.id))!;
  });
}

async function getRuleSetIn(tx: RLSTx, organizationId: string, id: string): Promise<StoredRuleSet | null> {
  const [row] = await queryRows<RuleSetRow & { source: SourceRow }>(tx, sql`${RULE_SET_SELECT} WHERE rs.id = ${id}::uuid AND rs.organization_id = ${organizationId}::uuid`);
  return row ? toRuleSet(row) : null;
}

export async function getRuleSet(organizationId: string, id: string): Promise<StoredRuleSet | null> {
  return withRLSContext({ organizationId }, (tx) => getRuleSetIn(tx, organizationId, id));
}

export async function listRuleSets(organizationId: string, filter: { regime?: string; procedureRoute?: string } = {}): Promise<StoredRuleSet[]> {
  return withRLSContext({ organizationId }, async (tx) => {
    const rows = await queryRows<RuleSetRow & { source: SourceRow }>(tx, sql`${RULE_SET_SELECT}
      WHERE rs.organization_id = ${organizationId}::uuid
        ${filter.regime ? sql`AND rs.regime = ${filter.regime}` : sql``}
        ${filter.procedureRoute ? sql`AND rs.procedure_route = ${filter.procedureRoute}` : sql``}
      ORDER BY rs.rule_key, rs.version`);
    return rows.map(toRuleSet);
  });
}

/** Rule sets and holiday calendars the engine selects from for a regime and route (every status, so selection can say "not adopted"). */
export async function loadRulesForSelectionIn(tx: RLSTx, organizationId: string, regime: string, procedureRoute: string) {
  const ruleSets = (await queryRows<RuleSetRow & { source: SourceRow }>(tx, sql`${RULE_SET_SELECT}
    WHERE rs.organization_id = ${organizationId}::uuid AND rs.regime = ${regime} AND rs.procedure_route = ${procedureRoute}
      AND rs.status IN ('draft','reviewed','adopted') ORDER BY rs.rule_key, rs.version`)).map(toRuleSet);
  const calendars = (await queryRows<CalendarRow>(tx, sql`SELECT * FROM procedural_holiday_calendars
    WHERE organization_id = ${organizationId}::uuid AND status IN ('draft','reviewed','adopted') ORDER BY calendar_key, version`)).map(toCalendar);
  return { ruleSets, calendars };
}

type Versioned = { status: RuleLifecycleStatus; origin: RuleOrigin; drafted_by: string; reviewed_by: string | null };

async function transition(
  organizationId: string,
  actor: LifecycleActor,
  table: 'procedural_rule_sets' | 'procedural_holiday_calendars',
  subjectType: 'rule_set' | 'holiday_calendar',
  id: string,
  target: RuleLifecycleStatus,
  reason: string,
) {
  return withRLSContext({ organizationId }, async (tx) => {
    const t = sql.raw(table);
    const [row] = await queryRows<Versioned>(tx, sql`SELECT status, origin, drafted_by, reviewed_by FROM ${t} WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`);
    if (!row) throw ApiError.notFound(subjectType === 'rule_set' ? 'Rule set' : 'Holiday calendar');
    const decision = decideLifecycleTransition({ status: row.status, origin: row.origin, draftedBy: row.drafted_by, reviewedBy: row.reviewed_by }, target, actor);
    if (!decision.ok) {
      await persistAtomicAudit(tx, { organizationId, userId: actor.userId, action: `procedural_${subjectType}.${target}`, resourceType: table, resourceId: id, details: { refused: decision.code } }, 'failure');
      throw decision.code === 'illegal_transition' ? ApiError.conflict(decision.message) : ApiError.forbidden(decision.message);
    }
    const set =
      target === 'reviewed'
        ? sql`status = 'reviewed', reviewed_by = ${actor.userId}, reviewed_at = now()`
        : target === 'adopted'
          ? sql`status = 'adopted', adopted_by = ${actor.userId}, adopted_at = now()`
          : target === 'draft'
            ? sql`status = 'draft', reviewed_by = NULL, reviewed_at = NULL`
            : sql`status = ${target}, closed_by = ${actor.userId}, closed_at = now()`;
    await tx.execute(sql`UPDATE ${t} SET ${set} WHERE id = ${id}::uuid AND organization_id = ${organizationId}::uuid`);
    await lifecycleEvent(tx, organizationId, subjectType, id, row.status, target, actor.userId, reason);
    await audit(tx, organizationId, actor.userId, `procedural_${subjectType}.${target}`, table, id, { from: row.status, to: target, reason });
    return { id, from: row.status, to: target };
  });
}

export function transitionRuleSet(organizationId: string, actor: LifecycleActor, id: string, target: RuleLifecycleStatus, reason: string) {
  return transition(organizationId, actor, 'procedural_rule_sets', 'rule_set', id, target, reason);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Holiday calendars

export async function createHolidayCalendarDraft(organizationId: string, actorId: string, input: HolidayCalendarDraftInput): Promise<StoredHolidayCalendar> {
  return withRLSContext({ organizationId }, async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('procedural_holiday_calendars:' || ${organizationId} || ':' || ${input.calendarKey}))`);
    const [{ next }] = await queryRows<{ next: number }>(tx, sql`SELECT COALESCE(MAX(version), 0) + 1 AS next FROM procedural_holiday_calendars
      WHERE organization_id = ${organizationId}::uuid AND calendar_key = ${input.calendarKey}`);
    const days = [...input.days].sort();
    const digest = digestOf({ sourceReference: input.sourceReference, coverageFrom: input.coverageFrom, coverageTo: input.coverageTo, days });
    const daysLiteral = `{${days.join(',')}}`;
    const [row] = await queryRows<CalendarRow>(tx, sql`INSERT INTO procedural_holiday_calendars
      (organization_id, calendar_key, version, status, origin, source_reference, coverage_from, coverage_to, days, content_digest, drafted_by)
      VALUES (${organizationId}::uuid, ${input.calendarKey}, ${Number(next)}, 'draft', ${input.origin}, ${input.sourceReference},
        ${input.coverageFrom}::date, ${input.coverageTo}::date, ${daysLiteral}::date[], ${digest}, ${actorId})
      RETURNING *`);
    await lifecycleEvent(tx, organizationId, 'holiday_calendar', row.id, null, 'draft', actorId, null);
    await audit(tx, organizationId, actorId, 'procedural_holiday_calendar.draft', 'procedural_holiday_calendars', row.id, { calendarKey: input.calendarKey, version: Number(next), contentDigest: digest });
    return toCalendar(row);
  });
}

export async function listHolidayCalendars(organizationId: string): Promise<StoredHolidayCalendar[]> {
  return withRLSContext({ organizationId }, async (tx) =>
    (await queryRows<CalendarRow>(tx, sql`SELECT * FROM procedural_holiday_calendars WHERE organization_id = ${organizationId}::uuid ORDER BY calendar_key, version`)).map(toCalendar),
  );
}

export function transitionHolidayCalendar(organizationId: string, actor: LifecycleActor, id: string, target: RuleLifecycleStatus, reason: string) {
  return transition(organizationId, actor, 'procedural_holiday_calendars', 'holiday_calendar', id, target, reason);
}

export async function listLifecycleEvents(organizationId: string, subjectId: string) {
  return withRLSContext({ organizationId }, (tx) =>
    queryRows<Record<string, unknown>>(tx, sql`SELECT subject_type, subject_id, from_status, to_status, actor_id, reason, created_at
      FROM procedural_rule_lifecycle_events WHERE organization_id = ${organizationId}::uuid AND subject_id = ${subjectId}::uuid ORDER BY created_at, id`),
  );
}
