/**
 * Group grievance participant and representation record routes: what each asks of the wrapper (membership and the case-suite
 * entitlement, no role floor — the kernel decides per grievance in the service), body validation before any service call, that
 * only the caller's own organization reaches the service, and the service refusals answered as 404/403/409. The refusals are
 * proven against real SQL in lib/representation-workflows/__tests__/service.pglite.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  readGroupParticipants: vi.fn(),
  addGroupParticipant: vi.fn(),
  withdrawGroupParticipant: vi.fn(),
  recordRepresentation: vi.fn(),
  readRepresentationRecords: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/representation-workflows/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/representation-workflows/service')>('@/lib/representation-workflows/service');
  return { ...actual, ...m };
});

const { caller, declared, resetCaller } = await import('./support/with-api-stub');
const { ApiError } = await import('@/lib/api/errors');

const GRIEVANCE = '44444444-4444-4444-8444-444444444444';
const PARTICIPANT = '55555555-5555-4555-8555-555555555555';
const st = (r: unknown) => (r instanceof Response ? r.status : 200);
const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/x', { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const consent = { memberUserId: 'm1', employerPortionRef: 'portion-north', consentForm: 'written_signature', consentEvidenceRef: 'doc-1', consentedAt: '2027-03-01T15:00:00Z' };
const who = { organizationId: 'org_1', userId: 'u1' };

beforeEach(() => {
  vi.clearAllMocks();
  resetCaller();
  caller.params = { id: GRIEVANCE, participantId: PARTICIPANT };
  for (const fn of Object.values(m)) fn.mockResolvedValue({ ok: true });
});

describe('group participant routes', () => {
  it('declare membership and the entitlement, no role floor', async () => {
    await import('../grievances/[id]/group-participants/route');
    await import('../grievances/[id]/group-participants/[participantId]/withdraw/route');
    await import('../grievances/[id]/representation-records/route');
    const mine = declared.filter((d) => /participant|representation record/i.test(d.openapi?.summary ?? ''));
    expect(mine.length).toBe(5);
    for (const d of mine) {
      expect(d.auth).toEqual({ required: true });
      expect(d.entitlement).toBe('grievance_case_suite');
    }
  });

  it('records consent with the caller organization; refuses a malformed consent and an unauthenticated caller before the service', async () => {
    const { POST } = await import('../grievances/[id]/group-participants/route');
    expect(st(await POST(req('POST', consent)))).toBe(200);
    expect(m.addGroupParticipant).toHaveBeenCalledWith(who, GRIEVANCE, consent);
    m.addGroupParticipant.mockClear();
    expect(st(await POST(req('POST', { ...consent, consentForm: 'verbal' })))).toBe(400);
    expect(st(await POST(req('POST', { ...consent, organizationId: 'org_2' })))).toBe(400);
    caller.userId = null;
    expect(st(await POST(req('POST', consent)))).toBe(401);
    expect(m.addGroupParticipant).not.toHaveBeenCalled();
  });

  it("answers another organization's grievance 404, a kernel refusal 403 and an incompatible cohort 409", async () => {
    const { POST } = await import('../grievances/[id]/group-participants/route');
    m.addGroupParticipant.mockRejectedValueOnce(ApiError.notFound('Grievance'));
    expect(st(await POST(req('POST', consent)))).toBe(404);
    m.addGroupParticipant.mockRejectedValueOnce(ApiError.forbidden());
    expect(st(await POST(req('POST', consent)))).toBe(403);
    m.addGroupParticipant.mockRejectedValueOnce(ApiError.conflict('incompatible', { code: 'incompatible_cohort' }));
    expect(st(await POST(req('POST', consent)))).toBe(409);
  });

  it('withdrawal needs a reason and valid ids', async () => {
    const { POST } = await import('../grievances/[id]/group-participants/[participantId]/withdraw/route');
    expect(st(await POST(req('POST', { reason: 'x', evidenceRef: null })))).toBe(400);
    caller.params = { id: GRIEVANCE, participantId: 'nope' };
    expect(st(await POST(req('POST', { reason: 'member asked to withdraw', evidenceRef: null })))).toBe(404);
    caller.params = { id: GRIEVANCE, participantId: PARTICIPANT };
    expect(st(await POST(req('POST', { reason: 'member asked to withdraw', evidenceRef: null })))).toBe(200);
    expect(m.withdrawGroupParticipant).toHaveBeenCalledWith(who, GRIEVANCE, PARTICIPANT, { reason: 'member asked to withdraw', evidenceRef: null });
  });
});

describe('representation record route', () => {
  it('passes kind, payload and parent through with the caller organization; refuses an unknown kind', async () => {
    const { POST, GET } = await import('../grievances/[id]/representation-records/route');
    const body = { kind: 'policy_filing', payload: { routeToFinalLevel: true, requiredApprovals: 2, summary: 'Policy matter' } };
    expect(st(await POST(req('POST', body)))).toBe(200);
    expect(m.recordRepresentation).toHaveBeenCalledWith(who, GRIEVANCE, 'policy_filing', body.payload, null);
    expect(st(await POST(req('POST', { kind: 'closure', payload: {} })))).toBe(400);
    expect(st(await GET(req('GET')))).toBe(200);
    expect(m.readRepresentationRecords).toHaveBeenCalledWith(who, GRIEVANCE);
  });

  it('answers self-approval 403 and a non-uuid grievance 404 without a service call', async () => {
    const { POST } = await import('../grievances/[id]/representation-records/route');
    m.recordRepresentation.mockRejectedValueOnce(ApiError.forbidden('The requester cannot approve their own filing.'));
    expect(st(await POST(req('POST', { kind: 'filing_approval', payload: { decision: 'approve', note: null }, parentRecordId: PARTICIPANT })))).toBe(403);
    m.recordRepresentation.mockClear();
    caller.params = { id: 'x' };
    expect(st(await POST(req('POST', { kind: 'abandonment', payload: {} })))).toBe(404);
    expect(m.recordRepresentation).not.toHaveBeenCalled();
  });
});
