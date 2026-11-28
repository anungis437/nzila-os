/**
 * Procedural rule administration routes and grievance procedure routes: what each asks of the wrapper (auth, role floor,
 * entitlement), body validation before any service call, the adoption role floor, and that the caller's own organization is
 * the only one a service is ever called with. Wrong-tenant and kernel-denied outcomes come from the services (proven against
 * real SQL in lib/procedural-rules/__tests__/procedural-store.pglite.test.ts) and are answered as 404/403 here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { regimeA, SYNTHETIC_HOLIDAYS_2027 } from '@/lib/procedural-rules/__tests__/synthetic-regimes';

const m = vi.hoisted(() => ({
  store: {
    createRuleSource: vi.fn(),
    listRuleSources: vi.fn(),
    createRuleSetDraft: vi.fn(),
    listRuleSets: vi.fn(),
    getRuleSet: vi.fn(),
    listLifecycleEvents: vi.fn(),
    transitionRuleSet: vi.fn(),
    createHolidayCalendarDraft: vi.fn(),
    listHolidayCalendars: vi.fn(),
    transitionHolidayCalendar: vi.fn(),
  },
  gp: {
    readGrievanceProcedure: vi.fn(),
    recordProcedureBinding: vi.fn(),
    recordProceduralFact: vi.fn(),
    voidProceduralFact: vi.fn(),
    computeGrievanceDeadline: vi.fn(),
    resolveProceduralException: vi.fn(),
  },
  hasMinRole: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/procedural-rules/store', () => m.store);
vi.mock('@/lib/procedural-rules/grievance-procedure', () => m.gp);
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');
const { ApiError } = await import('@/lib/api/errors');

const ID = '33333333-3333-4333-8333-333333333333';
const GRIEVANCE = '44444444-4444-4444-8444-444444444444';
const SOURCE_ID = '55555555-5555-4555-8555-555555555555';

/** The stub returns a handler result as is (the real wrapper wraps it as 200); a refusal comes back as a Response. */
const st = (r: unknown) => (r instanceof Response ? r.status : 200);

const req = (method: string, body?: unknown, url = 'http://localhost/api/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

const sourceBody = { kind: 'collective_agreement', title: 'Synthetic Agreement A', edition: '2026-2029', language: 'en', reference: 'Art. 18 (invented)', effectiveFrom: '2026-01-01', effectiveTo: null, supersedesSourceId: null };
const rs = regimeA();
const draftBody = {
  ruleKey: 'synthetic-a/standard', sourceId: SOURCE_ID, origin: 'ai_assisted_extraction', applicability: rs.applicability, effectiveFrom: '2026-01-01', effectiveTo: null,
  definition: { stages: rs.stages, transitions: rs.transitions, clocks: rs.clocks, requiredDeterminations: [], distinctDecisionMakerPerLevel: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetCaller();
  for (const fn of [...Object.values(m.store), ...Object.values(m.gp)]) fn.mockResolvedValue({ ok: true });
  m.hasMinRole.mockResolvedValue(true);
});

describe('rule administration routes', () => {
  it('declare authentication, role floors and the case-suite entitlement', async () => {
    await import('../procedural-rules/sources/route');
    await import('../procedural-rules/rule-sets/route');
    await import('../procedural-rules/rule-sets/[id]/lifecycle/route');
    await import('../procedural-rules/holiday-calendars/route');
    const floors = declared.filter((d) => d.openapi?.tags?.includes('Procedural Rules')).map((d) => [d.openapi?.summary, d.auth?.minRole, d.entitlement]);
    expect(floors).toEqual(expect.arrayContaining([
      ['List procedural rule sources', 'steward', 'grievance_case_suite'],
      ['Record a procedural rule source', 'officer', 'grievance_case_suite'],
      ['Draft the next version of a procedural rule set', 'officer', 'grievance_case_suite'],
      ['Review, adopt, supersede or retire a rule set version', 'officer', 'grievance_case_suite'],
      ['Draft the next version of a holiday calendar', 'officer', 'grievance_case_suite'],
    ]));
  });

  it('401 unauthenticated; 403 below the floor; nothing reaches the store', async () => {
    const { GET, POST } = await import('../procedural-rules/rule-sets/route');
    caller.userId = null;
    expect(st(await GET(req('GET')))).toBe(401);
    resetCaller();
    caller.role = 'member';
    expect(st(await GET(req('GET')))).toBe(403);
    caller.role = 'steward';
    expect(st(await POST(req('POST', draftBody)))).toBe(403);
    expect(m.store.createRuleSetDraft).not.toHaveBeenCalled();
    expect(m.store.listRuleSets).not.toHaveBeenCalled();
  });

  it('drafts with the caller organization and actor; an AI-assisted extraction is accepted only as a draft request', async () => {
    const { POST } = await import('../procedural-rules/rule-sets/route');
    caller.role = 'officer';
    expect(st(await POST(req('POST', draftBody)))).toBe(200);
    expect(m.store.createRuleSetDraft).toHaveBeenCalledWith('org_1', 'u1', expect.objectContaining({ origin: 'ai_assisted_extraction' }));
  });

  it('refuses a body that tries to set status, organization or an adopter', async () => {
    const { POST } = await import('../procedural-rules/rule-sets/route');
    for (const extra of [{ status: 'adopted' }, { organizationId: 'org_2' }, { adoptedBy: 'someone' }]) {
      expect(st(await POST(req('POST', { ...draftBody, ...extra })))).toBe(400);
    }
    expect(m.store.createRuleSetDraft).not.toHaveBeenCalled();
  });

  it('refuses a definition without an explicit day-count mode, with a dangling stage, or with two final stages', async () => {
    const { POST } = await import('../procedural-rules/rule-sets/route');
    const noMode = { ...draftBody, definition: { ...draftBody.definition, clocks: [{ ...rs.clocks[0], calendar: { weekendDays: [0, 6], holidays: 'excluded', rollForward: 'none' } }] } };
    const dangling = { ...draftBody, definition: { ...draftBody.definition, transitions: [{ from: 'L1', to: 'L9', kind: 'escalate' }] } };
    const twoFinal = { ...draftBody, definition: { ...draftBody.definition, stages: rs.stages.map((s) => ({ ...s, isFinal: s.key !== 'L1' })) } };
    for (const body of [noMode, dangling, twoFinal]) expect(st(await POST(req('POST', body)))).toBe(400);
    expect(m.store.createRuleSetDraft).not.toHaveBeenCalled();
  });

  it('adoption needs the admin floor: an officer may review but not adopt', async () => {
    const { POST } = await import('../procedural-rules/rule-sets/[id]/lifecycle/route');
    caller.params = { id: ID };
    caller.role = 'officer';
    m.hasMinRole.mockImplementation(async (floor: string) => floor === 'officer');
    expect(st(await POST(req('POST', { target: 'reviewed', reason: 'checked against the source' })))).toBe(200);
    expect(m.store.transitionRuleSet).toHaveBeenCalledWith('org_1', { userId: 'u1', kind: 'human' }, ID, 'reviewed', 'checked against the source');
    expect(st(await POST(req('POST', { target: 'adopted', reason: 'adopt' })))).toBe(403);
    expect(m.store.transitionRuleSet).toHaveBeenCalledTimes(1);
    expect(m.hasMinRole).toHaveBeenLastCalledWith('admin');
  });

  it('answers the store refusals: self-review 403, illegal move 409, another organization 404', async () => {
    const { POST } = await import('../procedural-rules/rule-sets/[id]/lifecycle/route');
    caller.params = { id: ID };
    m.store.transitionRuleSet.mockRejectedValueOnce(ApiError.forbidden('The reviewer must be someone other than the person who drafted the rule.'));
    expect(st(await POST(req('POST', { target: 'reviewed', reason: 'r' })))).toBe(403);
    m.store.transitionRuleSet.mockRejectedValueOnce(ApiError.conflict('A rule cannot move from draft to adopted.'));
    expect(st(await POST(req('POST', { target: 'adopted', reason: 'r' })))).toBe(409);
    m.store.transitionRuleSet.mockRejectedValueOnce(ApiError.notFound('Rule set'));
    expect(st(await POST(req('POST', { target: 'reviewed', reason: 'r' })))).toBe(404);
  });

  it('a non-uuid id is a 404 without a store call; an unknown target is a 400', async () => {
    const { POST } = await import('../procedural-rules/holiday-calendars/[id]/lifecycle/route');
    caller.params = { id: 'not-a-uuid' };
    expect(st(await POST(req('POST', { target: 'reviewed', reason: 'r' })))).toBe(404);
    caller.params = { id: ID };
    expect(st(await POST(req('POST', { target: 'executed', reason: 'r' })))).toBe(400);
    expect(m.store.transitionHolidayCalendar).not.toHaveBeenCalled();
  });

  it('holiday calendars: refuses a holiday outside the coverage span; records a valid draft', async () => {
    const { POST } = await import('../procedural-rules/holiday-calendars/route');
    const body = { calendarKey: 'synthetic-designated', origin: 'human_authored', sourceReference: SYNTHETIC_HOLIDAYS_2027.sourceReference, coverageFrom: '2027-01-01', coverageTo: '2027-12-31', days: SYNTHETIC_HOLIDAYS_2027.days };
    expect(st(await POST(req('POST', { ...body, days: ['2028-01-03'] })))).toBe(400);
    expect(st(await POST(req('POST', body)))).toBe(200);
    expect(m.store.createHolidayCalendarDraft).toHaveBeenCalledWith('org_1', 'u1', body);
  });

  it('sources: records with the caller organization', async () => {
    const { POST } = await import('../procedural-rules/sources/route');
    expect(st(await POST(req('POST', sourceBody)))).toBe(200);
    expect(m.store.createRuleSource).toHaveBeenCalledWith('org_1', 'u1', sourceBody);
    expect(st(await POST(req('POST', { ...sourceBody, language: 'english' })))).toBe(400);
  });
});

describe('grievance procedure routes', () => {
  it('declare membership and the entitlement but no role floor (the kernel decides per grievance)', async () => {
    await import('../grievances/[id]/procedure/route');
    await import('../grievances/[id]/procedure/facts/route');
    await import('../grievances/[id]/procedure/calculate/route');
    const routes = declared.filter((d) => d.openapi?.tags?.includes('Grievances') && /procedur/i.test(d.openapi?.summary ?? ''));
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const d of routes) {
      expect(d.auth).toEqual({ required: true });
      expect(d.entitlement).toBe('grievance_case_suite');
    }
  });

  it('calculate: passes the caller and the grievance; answers a computed deadline and an exception alike as recorded outcomes', async () => {
    const { POST } = await import('../grievances/[id]/procedure/calculate/route');
    caller.params = { id: GRIEVANCE };
    m.gp.computeGrievanceDeadline.mockResolvedValueOnce({ status: 'exception', exceptionId: ID, exceptions: [{ code: 'ambiguous_rule_sets' }] });
    const res = (await POST(req('POST', { clockKey: 'reply_l1' }))) as unknown;
    expect(st(res)).toBe(200);
    expect((res as { data: unknown }).data).toMatchObject({ status: 'exception' });
    expect(m.gp.computeGrievanceDeadline).toHaveBeenCalledWith({ organizationId: 'org_1', userId: 'u1' }, GRIEVANCE, 'reply_l1');
  });

  it("another organization's grievance answers 404; a kernel refusal answers 403", async () => {
    const { POST } = await import('../grievances/[id]/procedure/facts/route');
    caller.params = { id: GRIEVANCE };
    m.gp.recordProceduralFact.mockRejectedValueOnce(ApiError.notFound('Grievance'));
    expect(st(await POST(req('POST', { kind: 'trigger', payload: { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' } })))).toBe(404);
    m.gp.recordProceduralFact.mockRejectedValueOnce(ApiError.forbidden('This action is not permitted for this grievance.'));
    expect(st(await POST(req('POST', { kind: 'trigger', payload: { event: 'presentation', receivedAt: '2027-03-01T15:00:00Z' } })))).toBe(403);
  });

  it('a decision-maker conflict answers 409', async () => {
    const { POST } = await import('../grievances/[id]/procedure/facts/route');
    caller.params = { id: GRIEVANCE };
    m.gp.recordProceduralFact.mockRejectedValueOnce(ApiError.conflict('same decision-maker', { code: 'decision_maker_conflict' }));
    expect(st(await POST(req('POST', { kind: 'level_hearing', payload: { stageKey: 'L2', employerDecisionMakerRef: 'mgr-1' } })))).toBe(409);
  });

  it('refuses an unknown fact kind, a non-uuid grievance and an unauthenticated caller before any service call', async () => {
    const { POST } = await import('../grievances/[id]/procedure/facts/route');
    caller.params = { id: GRIEVANCE };
    expect(st(await POST(req('POST', { kind: 'deadline', payload: {} })))).toBe(400);
    caller.params = { id: 'x' };
    expect(st(await POST(req('POST', { kind: 'pause', payload: {} })))).toBe(404);
    caller.params = { id: GRIEVANCE };
    caller.userId = null;
    expect(st(await POST(req('POST', { kind: 'pause', payload: {} })))).toBe(401);
    expect(m.gp.recordProceduralFact).not.toHaveBeenCalled();
  });

  it('binding: refuses an organization in the body and records with the caller organization', async () => {
    const { PUT, GET } = await import('../grievances/[id]/procedure/route');
    caller.params = { id: GRIEVANCE };
    const binding = { regime: 'synthetic-a', procedureRoute: 'individual', employerRef: 'employer-1', bargainingGroup: null, classification: null, matterCategory: null, referenceDay: '2027-03-01', determinations: {} };
    expect(st(await PUT(req('PUT', { ...binding, organizationId: 'org_2' })))).toBe(400);
    expect(st(await PUT(req('PUT', binding)))).toBe(200);
    expect(m.gp.recordProcedureBinding).toHaveBeenCalledWith({ organizationId: 'org_1', userId: 'u1' }, GRIEVANCE, binding);
    expect(st(await GET(req('GET')))).toBe(200);
  });

  it('void and resolve require a reason and valid ids', async () => {
    const voidRoute = await import('../grievances/[id]/procedure/facts/[factId]/void/route');
    const resolveRoute = await import('../grievances/[id]/procedure/exceptions/[exceptionId]/route');
    caller.params = { id: GRIEVANCE, factId: ID, exceptionId: ID };
    expect(st(await voidRoute.POST(req('POST', { reason: '' })))).toBe(400);
    expect(st(await voidRoute.POST(req('POST', { reason: 'entered against the wrong level' })))).toBe(200);
    expect(st(await resolveRoute.POST(req('POST', { resolution: 'short' })))).toBe(400);
    expect(st(await resolveRoute.POST(req('POST', { resolution: 'reviewed: the side letter governs; deadline entered manually' })))).toBe(200);
    expect(m.gp.resolveProceduralException).toHaveBeenCalledWith({ organizationId: 'org_1', userId: 'u1' }, GRIEVANCE, ID, 'reviewed: the side letter governs; deadline entered manually');
  });
});
