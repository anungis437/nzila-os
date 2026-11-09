import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  submitVerifiedDependency: vi.fn(),
  listVerifiedDependencies: vi.fn(),
}));

vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  submitVerifiedDependency: m.submitVerifiedDependency,
  listVerifiedDependencies: m.listVerifiedDependencies,
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
  };
});

const ORG = 'org-1';

async function callGet(query: Record<string, unknown> = {}) {
  const { GET } = await import('../route');
  return (GET as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: ORG, query });
}

async function callPost(body: Record<string, unknown>, userId = 'u1') {
  const { POST } = await import('../route');
  return (POST as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: ORG, userId, body });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/exit-interviews/verified-dependencies', () => {
  it('lists records for the organization, forwarding an optional status filter', async () => {
    m.listVerifiedDependencies.mockResolvedValue([{ id: 'vd1', status: 'verified' }]);
    const result = await callGet({ status: 'verified' });
    expect(m.listVerifiedDependencies).toHaveBeenCalledWith(ORG, 'verified');
    expect(result).toEqual({ data: [{ id: 'vd1', status: 'verified' }] });
  });

  it('lists all records when no status filter is given', async () => {
    m.listVerifiedDependencies.mockResolvedValue([]);
    await callGet({});
    expect(m.listVerifiedDependencies).toHaveBeenCalledWith(ORG, undefined);
  });
});

describe('POST /api/exit-interviews/verified-dependencies', () => {
  it('submits new evidence attributed to the authenticated submitter', async () => {
    const record = { id: 'vd1', status: 'pending_review' };
    m.submitVerifiedDependency.mockResolvedValue(record);
    const body = {
      dependentNodeId: 'finance_clerk', dependsOnNodeId: 'payroll_system',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    };
    const result = await callPost(body, 'submitter-1');
    expect(m.submitVerifiedDependency).toHaveBeenCalledWith(ORG, body, 'submitter-1');
    expect(result).toEqual({ data: record });
  });

  it('propagates a store rejection (e.g. self-dependent submission) as a thrown error', async () => {
    m.submitVerifiedDependency.mockRejectedValue(new Error('dependentNodeId and dependsOnNodeId must differ'));
    await expect(callPost({
      dependentNodeId: 'a', dependsOnNodeId: 'a',
      processOrSystem: 'x', responsibleAuthority: 'x', evidenceReference: 'x',
    })).rejects.toThrow('must differ');
  });
});
