/**
 * The procedural rule store and grievance integration against PGlite running the real platform migration 0090 SQL (tables,
 * CHECKs, lifecycle, append-only and same-organization triggers). The authority kernel decision and the canonical audit writer
 * are stubbed; everything else is the production code. RLS itself (scoped 0063) is proven by the native PostgreSQL suite.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { regimeA, SYNTHETIC_HOLIDAYS_2027 } from './synthetic-regimes';

const state = vi.hoisted(() => ({
  db: null as unknown,
  deny: new Map<string, 'read' | 'action'>(),
  audits: [] as Array<{ action: string; outcome: string }>,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...a: unknown[]) => {
    const db = state.db as { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> };
    return db.transaction((tx) => (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(tx));
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: vi.fn(async (_tx: unknown, entry: { action: string }, outcome = 'success') => {
    state.audits.push({ action: entry.action, outcome });
  }),
}));
vi.mock('@/lib/authority/store/route-adapter', () => ({
  decideCase: vi.fn(async (_tx: unknown, input: { caseId: string; action: string }) => {
    const denied = state.deny.get(input.caseId);
    if (denied === 'read') return { effect: 'deny' };
    if (denied === 'action' && input.action !== 'case:read') return { effect: 'deny' };
    return { effect: 'allow' };
  }),
}));
vi.mock('@/lib/deadline-engine/organization-time-zone', () => ({ loadOrganizationTimeZone: async () => ({ timeZone: 'America/Toronto', source: 'settings' }) }));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const G_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const G_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const DRAFTER = 'user-drafter';
const REVIEWER = 'user-reviewer';
const actorA = { userId: 'user-handler', organizationId: ORG_A };

let pg: PGlite;

function migrationStatements(): string[] {
  const file = path.resolve(__dirname, '../../../db/migrations-platform/0090_procedural_rules.sql');
  return readFileSync(file, 'utf8').split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
}

beforeAll(async () => {
  const { createTableDatabase } = await import('@/app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([], [
    'CREATE TABLE organizations (id uuid primary key)',
    'CREATE TABLE grievances (id uuid primary key, organization_id uuid not null references organizations(id))',
    `CREATE TABLE grievance_deadlines (
       id uuid primary key default gen_random_uuid(), grievance_id uuid not null references grievances(id),
       deadline_type varchar(100) not null, description varchar(500), due_date timestamptz not null,
       status varchar(50) not null default 'pending', confirmation_status varchar(32) not null default 'SYSTEM_CALCULATED',
       calculated_due_date timestamptz, calculation_provenance jsonb default '{}', override_due_date timestamptz,
       superseded_at timestamptz, reminder_days integer[], created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  ]);
  pg = created.pg;
  state.db = created.db;
  for (const statement of migrationStatements()) await pg.exec(statement);
  await pg.exec(`INSERT INTO organizations VALUES ('${ORG_A}'), ('${ORG_B}');
    INSERT INTO grievances VALUES ('${G_A}', '${ORG_A}'), ('${G_B}', '${ORG_B}');`);
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  state.deny.clear();
  state.audits.length = 0;
  await pg.exec(`ALTER TABLE grievance_procedural_facts DISABLE TRIGGER USER; ALTER TABLE grievance_procedure_bindings DISABLE TRIGGER USER;
    ALTER TABLE grievance_procedural_exceptions DISABLE TRIGGER USER; ALTER TABLE procedural_rule_sets DISABLE TRIGGER USER;
    ALTER TABLE procedural_holiday_calendars DISABLE TRIGGER USER; ALTER TABLE procedural_rule_sources DISABLE TRIGGER USER;
    ALTER TABLE procedural_rule_lifecycle_events DISABLE TRIGGER USER;
    DELETE FROM grievance_procedural_facts; DELETE FROM grievance_procedure_bindings; DELETE FROM grievance_procedural_exceptions;
    DELETE FROM grievance_deadlines; DELETE FROM procedural_rule_lifecycle_events; DELETE FROM procedural_rule_sets;
    DELETE FROM procedural_holiday_calendars; DELETE FROM procedural_rule_sources;
    ALTER TABLE grievance_procedural_facts ENABLE TRIGGER USER; ALTER TABLE grievance_procedure_bindings ENABLE TRIGGER USER;
    ALTER TABLE grievance_procedural_exceptions ENABLE TRIGGER USER; ALTER TABLE procedural_rule_sets ENABLE TRIGGER USER;
    ALTER TABLE procedural_holiday_calendars ENABLE TRIGGER USER; ALTER TABLE procedural_rule_sources ENABLE TRIGGER USER;
    ALTER TABLE procedural_rule_lifecycle_events ENABLE TRIGGER USER;`);
});

const human = (userId: string) => ({ userId, kind: 'human' as const });

async function adoptedRegimeA(org = ORG_A, over: { status?: 'draft' | 'reviewed' | 'adopted' } = {}) {
  const store = await import('../store');
  const rs = regimeA();
  const source = await store.createRuleSource(org, DRAFTER, {
    kind: 'collective_agreement', title: rs.source.title, edition: rs.source.edition, language: 'en', reference: rs.source.reference,
    effectiveFrom: '2026-01-01', effectiveTo: null, supersedesSourceId: null,
  });
  const draft = await store.createRuleSetDraft(org, DRAFTER, {
    ruleKey: rs.key, sourceId: source.id, origin: 'human_authored', applicability: rs.applicability, effectiveFrom: rs.effectiveFrom, effectiveTo: null,
    definition: { stages: rs.stages, transitions: rs.transitions, clocks: rs.clocks, requiredDeterminations: rs.requiredDeterminations, distinctDecisionMakerPerLevel: rs.distinctDecisionMakerPerLevel },
  });
  const calendar = await store.createHolidayCalendarDraft(org, DRAFTER, {
    calendarKey: SYNTHETIC_HOLIDAYS_2027.calendarKey, origin: 'human_authored', sourceReference: SYNTHETIC_HOLIDAYS_2027.sourceReference,
    coverageFrom: SYNTHETIC_HOLIDAYS_2027.coverageFrom, coverageTo: SYNTHETIC_HOLIDAYS_2027.coverageTo, days: SYNTHETIC_HOLIDAYS_2027.days,
  });
  const target = over.status ?? 'adopted';
  for (const step of ['reviewed', 'adopted'] as const) {
    if (target === 'draft' || (target === 'reviewed' && step === 'adopted')) break;
    await store.transitionRuleSet(org, human(REVIEWER), draft.id, step, `${step} by an independent reviewer`);
  }
  await store.transitionHolidayCalendar(org, human(REVIEWER), calendar.id, 'reviewed', 'checked');
  await store.transitionHolidayCalendar(org, human(REVIEWER), calendar.id, 'adopted', 'adopted');
  return { source, ruleSetId: draft.id, calendarId: calendar.id };
}

const binding = { regime: 'synthetic-a', procedureRoute: 'individual', employerRef: 'employer-1', bargainingGroup: 'group-x', classification: 'class-1', matterCategory: null, referenceDay: '2027-03-01', determinations: {} };

describe('rule store and adoption lifecycle (real SQL)', () => {
  it('drafts version 1, then version 2 of the same key, both as drafts with a content digest', async () => {
    const store = await import('../store');
    const { source } = await adoptedRegimeA();
    const rs = regimeA();
    const v2 = await store.createRuleSetDraft(ORG_A, DRAFTER, {
      ruleKey: rs.key, sourceId: source.id, origin: 'ai_assisted_extraction', applicability: rs.applicability, effectiveFrom: '2027-06-01', effectiveTo: null,
      definition: { stages: rs.stages, transitions: rs.transitions, clocks: rs.clocks, requiredDeterminations: [], distinctDecisionMakerPerLevel: true },
    });
    expect(v2).toMatchObject({ version: 2, status: 'draft', origin: 'ai_assisted_extraction' });
    expect(v2.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(v2.source.edition).toBe('2026-2029');
  });

  it('refuses self-review and records the refusal', async () => {
    const store = await import('../store');
    const { source } = await adoptedRegimeA();
    const rs = regimeA();
    const d = await store.createRuleSetDraft(ORG_A, DRAFTER, { ruleKey: 'synthetic-a/other', sourceId: source.id, origin: 'human_authored', applicability: rs.applicability, effectiveFrom: '2026-01-01', effectiveTo: null,
      definition: { stages: rs.stages, transitions: rs.transitions, clocks: rs.clocks, requiredDeterminations: [], distinctDecisionMakerPerLevel: true } });
    await expect(store.transitionRuleSet(ORG_A, human(DRAFTER), d.id, 'reviewed', 'self')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(state.audits.at(-1)).toEqual({ action: 'procedural_rule_set.reviewed', outcome: 'failure' });
    await expect(store.transitionRuleSet(ORG_A, { userId: 'extractor', kind: 'automated' }, d.id, 'reviewed', 'bot')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(store.transitionRuleSet(ORG_A, human(REVIEWER), d.id, 'adopted', 'skip review')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('records each lifecycle step as an append-only event', async () => {
    const store = await import('../store');
    const { ruleSetId } = await adoptedRegimeA();
    const events = await store.listLifecycleEvents(ORG_A, ruleSetId);
    expect(events.map((e) => [e.from_status, e.to_status])).toEqual([[null, 'draft'], ['draft', 'reviewed'], ['reviewed', 'adopted']]);
    await expect(pg.exec(`UPDATE procedural_rule_lifecycle_events SET reason = 'rewritten'`)).rejects.toThrow(/append-only/);
    await expect(pg.exec(`DELETE FROM procedural_rule_lifecycle_events`)).rejects.toThrow(/append-only/);
  });

  it('the database freezes content after review and refuses an illegal status move or self-adoption', async () => {
    const { ruleSetId } = await adoptedRegimeA();
    await expect(pg.exec(`UPDATE procedural_rule_sets SET definition = '{}'::jsonb WHERE id = '${ruleSetId}'`)).rejects.toThrow(/frozen/);
    await expect(pg.exec(`UPDATE procedural_rule_sets SET status = 'draft' WHERE id = '${ruleSetId}'`)).rejects.toThrow(/cannot move from adopted to draft/);
    await expect(pg.exec(`DELETE FROM procedural_rule_sets WHERE id = '${ruleSetId}'`)).rejects.toThrow(/append-only/);
    await expect(
      pg.exec(`INSERT INTO procedural_rule_sets (organization_id, rule_key, version, status, origin, source_id, regime, procedure_route, applicability, effective_from, definition, content_digest, drafted_by, reviewed_by, reviewed_at, adopted_by, adopted_at)
        SELECT organization_id, 'synthetic-a/self', 1, 'adopted', 'human_authored', source_id, regime, procedure_route, applicability, effective_from, definition, content_digest, 'same', 'other', now(), 'same', now()
        FROM procedural_rule_sets WHERE id = '${ruleSetId}'`),
    ).rejects.toThrow(/independent_adoption/);
  });

  it('rule sources are append-only', async () => {
    const { source } = await adoptedRegimeA();
    await expect(pg.exec(`UPDATE procedural_rule_sources SET edition = 'x' WHERE id = '${source.id}'`)).rejects.toThrow(/append-only/);
  });

  it("another organization's rule sets are not selected", async () => {
    const store = await import('../store');
    await adoptedRegimeA(ORG_B);
    expect(await store.listRuleSets(ORG_A)).toEqual([]);
    expect(await store.listRuleSets(ORG_B)).toHaveLength(1);
  });
});

describe('grievance integration: calculated_due_date with evidence, or an exception', () => {
  it('fills calculated_due_date with the evidence when one adopted rule set governs', async () => {
    const gp = await import('../grievance-procedure');
    const { ruleSetId, calendarId } = await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    await gp.recordProceduralFact(actorA, G_A, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' });
    const out = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(out).toMatchObject({ status: 'computed', dueDay: '2027-03-15', dueAt: '2027-03-16T03:59:00.000Z', written: 'created' });
    const { rows } = await pg.query<{ calculated_due_date: Date; due_date: Date; confirmation_status: string; calculation_provenance: Record<string, any>; deadline_type: string }>(
      `SELECT * FROM grievance_deadlines WHERE grievance_id = '${G_A}'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].calculated_due_date.toISOString()).toBe('2027-03-16T03:59:00.000Z');
    expect(rows[0].due_date.toISOString()).toBe('2027-03-16T03:59:00.000Z');
    expect(rows[0].confirmation_status).toBe('SYSTEM_CALCULATED');
    expect(rows[0].deadline_type).toBe('procedural:reply_l1');
    expect(rows[0].calculation_provenance.ruleSet.id).toBe(ruleSetId);
    expect(rows[0].calculation_provenance.holidayCalendar.id).toBe(calendarId);
    expect(rows[0].calculation_provenance.engineVersion).toBe('procedural-engine/1');
    expect(state.audits.some((a) => a.action === 'grievance_procedure.deadline.calculate')).toBe(true);
  });

  it('recalculating unchanged facts leaves the row unchanged; a new pause recalculates it', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    await gp.recordProceduralFact(actorA, G_A, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' });
    const first = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1')).toMatchObject({ written: 'unchanged' });
    await gp.recordProceduralFact(actorA, G_A, 'pause', { startDay: '2027-03-08', endDay: '2027-03-12', reason: 'joint abeyance', authority: 'both parties' });
    const again = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(again).toMatchObject({ status: 'computed', dueDay: '2027-03-22', written: 'recalculated' });
    expect(again.status === 'computed' && first.status === 'computed' && again.deadlineId === first.deadlineId).toBe(true);
  });

  it('never moves a human-confirmed date: a different recalculation becomes an exception', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    await gp.recordProceduralFact(actorA, G_A, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' });
    await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    await pg.exec(`UPDATE grievance_deadlines SET confirmation_status = 'HUMAN_CONFIRMED'`);
    await gp.recordProceduralFact(actorA, G_A, 'pause', { startDay: '2027-03-08', endDay: '2027-03-12', reason: 'abeyance', authority: 'both parties' });
    const out = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(out).toMatchObject({ status: 'exception', exceptions: [{ code: 'confirmed_deadline_differs' }] });
    const { rows } = await pg.query<{ due_date: Date }>(`SELECT due_date FROM grievance_deadlines`);
    expect(rows[0].due_date.toISOString()).toBe('2027-03-16T03:59:00.000Z');
  });

  it('an unadopted rule set raises one open exception and writes no deadline', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA(ORG_A, { status: 'reviewed' });
    await gp.recordProcedureBinding(actorA, G_A, binding);
    await gp.recordProceduralFact(actorA, G_A, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' });
    const out = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(out).toMatchObject({ status: 'exception', exceptions: [{ code: 'rule_set_not_adopted' }] });
    const again = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(again.status === 'exception' && out.status === 'exception' && again.exceptionId === out.exceptionId).toBe(true);
    expect((await pg.query(`SELECT 1 FROM grievance_deadlines`)).rows).toHaveLength(0);
    expect((await pg.query(`SELECT status FROM grievance_procedural_exceptions`)).rows).toEqual([{ status: 'open' }]);
  });

  it('no binding at all is an exception, not a guessed date', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    const out = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(out).toMatchObject({ status: 'exception', exceptions: [{ code: 'missing_reference_day' }] });
  });

  it('a later computed deadline supersedes the open exception; a reviewer can resolve an exception', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    const ex = await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect(ex).toMatchObject({ status: 'exception', exceptions: [{ code: 'missing_trigger' }] });
    await gp.recordProceduralFact(actorA, G_A, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' });
    await gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1');
    expect((await pg.query(`SELECT status FROM grievance_procedural_exceptions`)).rows).toEqual([{ status: 'superseded' }]);
    const missing = await gp.computeGrievanceDeadline(actorA, G_A, 'filing');
    if (missing.status !== 'exception') throw new Error('expected exception');
    await gp.resolveProceduralException(actorA, G_A, missing.exceptionId, 'filing limit tracked manually after review');
    await expect(gp.resolveProceduralException(actorA, G_A, missing.exceptionId, 'again')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(pg.exec(`UPDATE grievance_procedural_exceptions SET evidence = '{}'::jsonb`)).rejects.toThrow(/resolved exception cannot change|only the resolution/);
  });
});

describe('employer decision-maker per level and level waivers', () => {
  it('refuses the same employer decision-maker at a second level (409) and records the refusal', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    expect(await gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L1', employerDecisionMakerRef: 'mgr-1' })).toMatchObject({ decisionMakerCheck: 'passed' });
    await expect(gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L2', employerDecisionMakerRef: 'mgr-1' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(state.audits.at(-1)).toEqual({ action: 'grievance_procedure.fact.level_hearing', outcome: 'failure' });
    expect(await gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L2', employerDecisionMakerRef: 'mgr-2' })).toMatchObject({ decisionMakerCheck: 'passed' });
  });

  it('records a hearing but says the check was unavailable when no rule set governs', async () => {
    const gp = await import('../grievance-procedure');
    expect(await gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L1', employerDecisionMakerRef: 'mgr-1' })).toMatchObject({
      decisionMakerCheck: 'unavailable',
      unavailableReason: 'missing_reference_day',
    });
  });

  it('accepts a waiver of a waivable level and refuses a waiver the rule set does not define', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    await expect(gp.recordProceduralFact(actorA, G_A, 'level_waiver', { fromStageKey: 'L1', toStageKey: 'L3', unionPartyRef: 'u', employerPartyRef: 'e', agreedOnDay: '2027-03-02' })).resolves.toMatchObject({ factId: expect.any(String) });
    await expect(gp.recordProceduralFact(actorA, G_A, 'level_waiver', { fromStageKey: 'L2', toStageKey: 'L3', unionPartyRef: 'u', employerPartyRef: 'e', agreedOnDay: '2027-03-02' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a voided fact stays as history and no longer counts', async () => {
    const gp = await import('../grievance-procedure');
    await adoptedRegimeA();
    await gp.recordProcedureBinding(actorA, G_A, binding);
    const { factId } = await gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L1', employerDecisionMakerRef: 'mgr-1' });
    await gp.voidProceduralFact(actorA, G_A, factId, 'recorded against the wrong level');
    expect(await gp.recordProceduralFact(actorA, G_A, 'level_hearing', { stageKey: 'L2', employerDecisionMakerRef: 'mgr-1' })).toMatchObject({ decisionMakerCheck: 'passed' });
    const view = await gp.readGrievanceProcedure(actorA, G_A);
    expect(view.facts).toHaveLength(2);
    await expect(pg.exec(`UPDATE grievance_procedural_facts SET payload = '{}'::jsonb WHERE id = '${factId}'`)).rejects.toThrow(/closed record cannot change/);
    await expect(pg.exec(`DELETE FROM grievance_procedural_facts`)).rejects.toThrow(/append-only/);
  });
});

describe('tenant and authority negatives', () => {
  it("another organization's grievance answers 404 and nothing is written", async () => {
    const gp = await import('../grievance-procedure');
    await expect(gp.recordProceduralFact(actorA, G_B, 'trigger', { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(gp.computeGrievanceDeadline(actorA, G_B, 'reply_l1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await pg.query(`SELECT 1 FROM grievance_procedural_facts`)).rows).toHaveLength(0);
  });

  it('the database refuses a grievance-scoped row whose organization is not the grievance organization', async () => {
    await expect(pg.exec(`INSERT INTO grievance_procedural_facts (organization_id, grievance_id, fact_kind, payload, recorded_by)
      VALUES ('${ORG_A}', '${G_B}', 'trigger', '{}'::jsonb, 'x')`)).rejects.toThrow(/is not in organization/);
  });

  it('an actor the kernel will not let read the grievance gets 404; one who may read but not act gets 403', async () => {
    const gp = await import('../grievance-procedure');
    state.deny.set(G_A, 'read');
    await expect(gp.readGrievanceProcedure(actorA, G_A)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    state.deny.set(G_A, 'action');
    await expect(gp.recordProcedureBinding(actorA, G_A, binding)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(gp.computeGrievanceDeadline(actorA, G_A, 'reply_l1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await pg.query(`SELECT 1 FROM grievance_procedure_bindings`)).rows).toHaveLength(0);
  });

  it('rejects a malformed fact before any write', async () => {
    const gp = await import('../grievance-procedure');
    await expect(gp.recordProceduralFact(actorA, G_A, 'pause', { startDay: '2027-03-09', endDay: '2027-03-01', reason: 'x', authority: 'y' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
