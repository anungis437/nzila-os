import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  withRLSContext: vi.fn(),
  createEvidencePack: vi.fn(),
  sha256: vi.fn(),
}));

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
};

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      notFound: (message: string) => makeError(404, message),
    },
  };
});

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('../employer-execution/_lib', () => ({
  createEvidencePack: m.createEvidencePack,
  sha256: m.sha256,
}));

async function loadRoute() {
  return import('../employer-execution/remittance-runs/route');
}

describe('employer-execution/remittance-runs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.sha256.mockReturnValue('hash_1');
    m.createEvidencePack.mockReturnValue({
      manifestHash: 'manifest_1',
      seal: 'seal_1',
      chainLink: { parentLinkId: null, parentSealHash: null, chainDepth: 1 },
      manifest: { ok: true },
    });

    let call = 0;
    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      call += 1;
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => {
            if (call === 1) {
              return {
                returning: vi.fn(async () => [{
                  id: 'rr_1',
                  runCode: 'rr-1',
                  status: 'generated',
                  generatedAt: new Date().toISOString(),
                }]),
              };
            }
            return Promise.resolve([]);
          }),
        })),
      };
      return fn(tx);
    });
  });

  it('GET returns remittance runs for organization', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: 'rr_1', runCode: 'rr-1' }]);

    const result = await GET({ organizationId: 'org_1' } as any);
    expect(result.data).toHaveLength(1);
  });

  it('POST throws when organization is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ organizationId: '', body: { payrollRunId: 'x' } } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('POST throws when payroll run does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    await expect(
      POST({ organizationId: 'org_1', userId: 'u1', body: { payrollRunId: 'run_1' } } as any),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('POST throws when payroll run is not approved', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'run_1', status: 'draft' }]);

    await expect(
      POST({ organizationId: 'org_1', userId: 'u1', body: { payrollRunId: 'run_1' } } as any),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('POST generates remittance package for approved payroll run', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'run_1', status: 'approved', periodEnd: '2026-01-31', periodStart: '2026-01-01', runCode: 'pr-1', engineVersion: '1', cbaRuleVersionId: null, sourceBatchId: null, calcTraceHash: null, approvedBy: 'u1', approvedAt: new Date().toISOString() }],
      [],
      [{ employeeExternalId: 'e1', duesAmount: '10', benefitAmount: '2', pensionAmount: '3', grossPay: '100', netPay: '85' }],
    );

    const result = await POST({ organizationId: 'org_1', userId: 'u1', body: { payrollRunId: 'run_1' } } as any);

    expect(result.data.remittanceRun.id).toBe('rr_1');
    expect(m.createEvidencePack).toHaveBeenCalled();
  });
});
