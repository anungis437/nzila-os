import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  getCaseActor: vi.fn(), requireKernelCaseAction: vi.fn(), db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(), persistAtomicAudit: vi.fn(),
  buildUnionEvidencePack: vi.fn(), trackPilotEvent: vi.fn(), inserted: vi.fn(),
}));
vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/cases/case-authorization', () => ({ requireKernelCaseAction: m.requireKernelCaseAction, getCaseActor: m.getCaseActor }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
const { caller, declared, resetCaller } = await import('./support/with-api-stub');
const { ApiError } = await import('@/lib/api/errors');
const { PATCH } = await import('../grievances/[id]/status/route');
const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const patch = (status: string, notes?: string) => new Request(`http://localhost/api/grievances/${GRIEVANCE}/status`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, notes }),
});
const oldClock = () => new Date(Date.now() - 9 * 86400000);
function grievance(status = 'acknowledged', unionRepId: string | null = 'primary', stateClock = oldClock(), description = 'Recorded synthetic grievance investigation and resolution documentation.') {
  m.db.select.mockReturnValue({ from: () => ({ where: () => ({
    for: vi.fn(async () => [{ id: GRIEVANCE, status, unionRepId, description,
      priority: 'medium', createdAt: oldClock(), updatedAt: new Date() }]),
    orderBy: () => ({ limit: async () => [{ createdAt: stateClock }] }),
  }) }) });
}
function deny(action: string) {
  m.requireKernelCaseAction.mockImplementation(async (_tx, _actor, _id, requested) => {
    if (requested === action) throw ApiError.forbidden('Kernel denied');
  });
}
describe('grievance transition live action authority', () => {
  beforeEach(() => {
    vi.clearAllMocks(); resetCaller(); caller.params = { id: GRIEVANCE };
    m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org_1', role: 'steward' }); m.requireKernelCaseAction.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined); m.trackPilotEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_context, fn) => fn(m.db)); grievance();
    m.db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => [{ id: GRIEVANCE, status: 'investigating' }] }) }) });
    m.db.insert.mockReturnValue({ values: m.inserted.mockResolvedValue(undefined) });
  });
  it('requires membership, case entitlement and tenant transaction', () => {
    expect(declared.find(entry => entry.openapi?.summary === 'Advance a grievance through the lifecycle'))
      .toMatchObject({ auth: { required: true }, entitlement: 'grievance_case_suite', rlsOrgContext: true });
  });
  it('rejects malformed ids and unknown statuses before database access', async () => {
    caller.params = { id: 'bad' }; expect((await PATCH(patch('closed'))).status).toBe(400);
    caller.params = { id: GRIEVANCE }; expect((await PATCH(patch('unknown'))).status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
  it('answers404 outside the tenant scope', async () => {
    m.db.select.mockReturnValue({ from: () => ({ where: () => ({ for: async () => [] }) }) });
    expect((await PATCH(patch('investigating'))).status).toBe(404);
    expect(m.requireKernelCaseAction).not.toHaveBeenCalled(); expect(m.db.update).not.toHaveBeenCalled();
  });
  it('does not infer authority from seniority or collaborator labels', async () => {
    deny('case:transition'); expect((await PATCH(patch('investigating'))).status).toBe(403);
    expect(m.db.update).not.toHaveBeenCalled(); expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.trackPilotEvent).not.toHaveBeenCalled(); expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });
  it('does not revive the unassigned-draft fallback', async () => {
    grievance('draft', null); deny('case:transition');
    expect((await PATCH(patch('closed_no_case'))).status).toBe(403); expect(m.db.update).not.toHaveBeenCalled();
  });
  it.each(['closed', 'withdrawn', 'denied', 'closed_no_case'])('requires primary closure for legacy target %s', async status => {
    deny('case:close'); expect((await PATCH(patch(status))).status).toBe(403);
    expect(m.requireKernelCaseAction).toHaveBeenLastCalledWith(m.db, { organizationId: 'org_1', userId: 'u1' }, GRIEVANCE, 'case:close');
    expect(m.db.update).not.toHaveBeenCalled(); expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
  it('requires closure authority when reopening', async () => {
    grievance('closed'); deny('case:close'); expect((await PATCH(patch('investigating'))).status).toBe(403);
    expect(m.db.update).not.toHaveBeenCalled();
  });
  it('keeps authorized transition and confines the reason to restricted audit', async () => {
    expect((await PATCH(patch('investigating', 'confidential strategy'))).status).toBe(200);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { organizationId: 'org_1', userId: 'u1' }, GRIEVANCE, 'case:transition');
    expect(m.requireKernelCaseAction).toHaveBeenCalledTimes(1);
    expect(m.inserted).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Status changed: acknowledged → investigating' }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ details: expect.objectContaining({ reason: 'confidential strategy' }) }));
  });
  it('keeps authorized primary closure', async () => {
    grievance('settled'); expect((await PATCH(patch('closed'))).status).toBe(200);
    expect(m.requireKernelCaseAction).toHaveBeenCalledTimes(2); expect(m.persistAtomicAudit).toHaveBeenCalled();
  });
  it('does not treat resolution as closure', async () => {
    grievance('investigating'); expect((await PATCH(patch('settled'))).status).toBe(200); expect(m.requireKernelCaseAction).toHaveBeenCalledTimes(1);
  });
  it('retains FSM denial for authorized actors', async () => {
    grievance('closed');
    expect((await PATCH(patch('closed'))).status).toBe(400); expect(m.db.update).not.toHaveBeenCalled();
  });
  it.each(['steward', 'chief_steward', 'officer'])(
    'allows documented primary-handler %s closure through the actual lifecycle policy', async role => {
      grievance('settled'); m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org_1', role });
      expect((await PATCH(patch('closed'))).status).toBe(200);
      expect(m.requireKernelCaseAction).toHaveBeenCalledTimes(2);
    },
  );
  it('uses the latest status event instead of an old creation date or recent edit', async () => {
    grievance('settled', 'primary', new Date());
    expect((await PATCH(patch('closed'))).status).toBe(400);
    expect(m.db.update).not.toHaveBeenCalled();
  });
  it('requires documentation for an actual resolution and accepts an authorized outcome reason', async () => {
    grievance('investigating', 'primary', oldClock(), 'Short');
    expect((await PATCH(patch('settled'))).status).toBe(400);
    expect(m.db.update).not.toHaveBeenCalled();
    expect((await PATCH(patch('settled', 'Recorded synthetic outcome and supporting documentation.'))).status).toBe(200);
  });
  it('refuses a mismatched live actor before writing', async () => {
    m.getCaseActor.mockResolvedValue({ userId: 'other', organizationId: 'org_1', role: 'steward' });
    expect((await PATCH(patch('investigating'))).status).toBe(403);
    expect(m.db.update).not.toHaveBeenCalled();
  });
  it('propagates audit failure without downstream effects', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit failure'));
    expect((await PATCH(patch('investigating'))).status).toBeGreaterThanOrEqual(500);
    expect(m.trackPilotEvent).not.toHaveBeenCalled(); expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });
});
