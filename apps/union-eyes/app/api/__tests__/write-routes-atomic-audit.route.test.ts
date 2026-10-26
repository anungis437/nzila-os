import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  returned: [] as unknown[],
  selected: [] as unknown[],
  persistAtomicAudit: vi.fn(),
  createSatisfactionSurvey: vi.fn(),
  evaluate: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
  },
  z: require('zod'),
}));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({
  claims: { id: 'id', organizationId: 'organizationId', memberId: 'memberId', assignedTo: 'assignedTo' },
  kpiConfigurations: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('@/db/schema/audit-security-schema', () => ({ auditLogs: { organizationId: 'organizationId', createdAt: 'createdAt' } }));
vi.mock('@/db/schema/mobile-devices-schema', () => ({
  mobileDevices: { id: 'id', userId: 'userId', organizationId: 'organizationId', deviceId: 'deviceId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn() }));
vi.mock('@/lib/services/satisfaction-service', () => ({
  getPendingSurveys: vi.fn(),
  createSatisfactionSurvey: m.createSatisfactionSurvey,
}));
vi.mock('@/lib/services/policy-engine', () => ({ policyEngine: { evaluate: m.evaluate } }));

const chain = (rows: () => unknown[]) => {
  const c: Record<string, unknown> = {};
  for (const name of ['set', 'values', 'from', 'where', 'limit', 'onConflictDoUpdate']) c[name] = () => c;
  c.returning = async () => rows();
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows()).then(resolve);
  return c;
};
const tx = {
  select: () => chain(() => m.selected),
  insert: () => chain(() => m.returned),
  update: () => chain(() => m.returned),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const caller = { organizationId: 'org_1', userId: 'u1' };

describe('compliance/audit-logs POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('records a manual entry attributed to the administrator who wrote it, not as a forged system record', async () => {
    const { POST } = await import('../compliance/audit-logs/route');
    const result = await POST({
      ...caller,
      body: { action: 'member.deleted', resourceType: 'member', severity: 'info', outcome: 'success', metadata: { declaredAction: 'spoofed' } },
    });

    expect(result).toEqual({ recorded: true });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'compliance.manual_entry',
        details: expect.objectContaining({ declaredAction: 'member.deleted', declaredOutcome: 'success' }),
      }),
    );
  });

  it('fails when the entry cannot be written', async () => {
    const { POST } = await import('../compliance/audit-logs/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      POST({ ...caller, body: { action: 'a', resourceType: 'r', severity: 'info', outcome: 'success' } }),
    ).rejects.toThrow('audit unavailable');
  });
});

describe('targets POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.returned = [{ id: 't1' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  const body = {
    name: 'Grievance resolution',
    metricType: 'rate',
    dataSource: 'claims',
    calculation: { aggregation: 'sum' },
    visualizationType: 'gauge',
    alertEnabled: false,
  };

  it('creates the target and audits it on the same transaction', async () => {
    const { POST } = await import('../targets/route');
    const result = await POST({ ...caller, body });

    expect(result).toEqual({ id: 't1' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'target.create', resourceId: 't1' }),
    );
  });

  it('fails the creation when its audit cannot be written', async () => {
    const { POST } = await import('../targets/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(POST({ ...caller, body })).rejects.toThrow('audit unavailable');
  });
});

describe('satisfaction POST (a steward creating a survey by hand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selected = [{ memberId: 'member_1', assignedTo: 'lro_1' }];
    m.createSatisfactionSurvey.mockResolvedValue({ id: 'srv1' });
  });

  const body = { claimId: '11111111-1111-4111-8111-111111111111', memberId: 'member_1', lroId: 'lro_1' };

  it('creates the survey for the claim\u2019s own member and records the steward as the actor', async () => {
    const { POST } = await import('../satisfaction/route');
    const result = await POST({ ...caller, body });

    expect(result).toEqual({ id: 'srv1' });
    expect(m.createSatisfactionSurvey).toHaveBeenCalledWith(
      { organizationId: 'org_1', claimId: body.claimId, memberId: 'member_1', lroId: 'lro_1' },
      'u1',
    );
  });

  it('answers 404 for a claim outside the organization, and refuses a survey for a member who did not file the claim', async () => {
    const { POST } = await import('../satisfaction/route');

    m.selected = [];
    await expect(POST({ ...caller, body })).rejects.toMatchObject({ status: 404 });

    m.selected = [{ memberId: 'someone_else', assignedTo: 'lro_1' }];
    await expect(POST({ ...caller, body })).rejects.toMatchObject({ status: 400 });

    m.selected = [{ memberId: 'member_1', assignedTo: 'another_lro' }];
    await expect(POST({ ...caller, body })).rejects.toMatchObject({ status: 400 });

    expect(m.createSatisfactionSurvey).not.toHaveBeenCalled();
  });
});

describe('mobile/sync POST (device registration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selected = [];
    m.returned = [{ id: 'dev1' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  const request = {
    json: async () => ({ deviceToken: 'tok', deviceId: 'device-1', platform: 'ios' }),
  };

  it('registers the caller\u2019s device and audits it without the device token', async () => {
    const { POST } = await import('../mobile/sync/route');
    const result = await POST({ ...caller, request });

    expect(result).toEqual({ id: 'dev1' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: 'u1', action: 'mobile.device.register', resourceId: 'dev1', details: { platform: 'ios', deviceId: 'device-1' } }),
    );
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('"tok"');
  });

  it('refuses a device already registered to another account, and a hijack that raced past the check, writing no audit', async () => {
    const { POST } = await import('../mobile/sync/route');

    m.selected = [{ userId: 'victim' }];
    await expect(POST({ ...caller, request })).rejects.toMatchObject({ status: 409 });

    m.selected = [];
    m.returned = []; // the ownership predicate on the upsert matched nothing
    await expect(POST({ ...caller, request })).rejects.toMatchObject({ status: 409 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});

describe('governance/policies/evaluate POST', () => {
  it('passes the evaluating administrator to the engine so the evaluation is attributed', async () => {
    const { POST } = await import('../governance/policies/evaluate/route');
    m.evaluate.mockResolvedValue({ passed: true });

    await POST({
      organizationId: 'org_1',
      userId: 'admin_1',
      body: { ruleType: 't', category: 'c', subjectType: 'member', subjectId: '11111111-1111-4111-8111-111111111111', inputData: {} },
    });

    expect(m.evaluate).toHaveBeenCalledWith('org_1', 't', 'c', expect.objectContaining({ subjectType: 'member' }), 'admin_1');
  });
});
