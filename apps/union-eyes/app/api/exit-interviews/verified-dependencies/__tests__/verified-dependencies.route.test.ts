import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => {
  class VerifiedDependencyInputError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
    }
  }
  return {
    submitVerifiedDependency: vi.fn(),
    listVerifiedDependenciesWithCurrentness: vi.fn(),
    listActiveNodeAliases: vi.fn(async () => []),
    VerifiedDependencyInputError,
  };
});

vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  submitVerifiedDependency: m.submitVerifiedDependency,
  listVerifiedDependenciesWithCurrentness: m.listVerifiedDependenciesWithCurrentness,
  VerifiedDependencyInputError: m.VerifiedDependencyInputError,
}));
vi.mock('@/lib/knowledge-transfer/propagation/node-alias-store', () => ({
  listActiveNodeAliases: m.listActiveNodeAliases,
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: {
      badRequest: (message: string, details?: unknown) => Object.assign(new Error(message), { status: 400, details }),
      conflict: (message: string, details?: unknown) => Object.assign(new Error(message), { status: 409, details }),
    },
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
  it('lists records with their currentness for the organization, forwarding an optional status filter', async () => {
    const rows = [
      { id: 'vd1', status: 'verified', currentness: { state: 'current', evidenceTier: 'human_attested_external', resolvedDependentNodeId: 'a', resolvedDependsOnNodeId: 'b' } },
      { id: 'vd2', status: 'verified', currentness: { state: 'requires_reverification', staleReasons: ['evidence_document_changed'] } },
    ];
    m.listVerifiedDependenciesWithCurrentness.mockResolvedValue(rows);
    const result = await callGet({ status: 'verified' });
    expect(m.listVerifiedDependenciesWithCurrentness).toHaveBeenCalledWith(ORG, 'verified');
    expect(result).toEqual({ data: rows });
  });

  it('lists all records when no status filter is given', async () => {
    m.listVerifiedDependenciesWithCurrentness.mockResolvedValue([]);
    await callGet({});
    expect(m.listVerifiedDependenciesWithCurrentness).toHaveBeenCalledWith(ORG, undefined);
  });
});

describe('POST /api/exit-interviews/verified-dependencies', () => {
  it('submits new evidence attributed to the authenticated submitter', async () => {
    const record = { id: 'vd1', status: 'pending_review' };
    m.submitVerifiedDependency.mockResolvedValue(record);
    const body = {
      dependentNodeId: 'finance_steward', dependsOnNodeId: 'payroll_system',
      processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114',
    };
    const result = await callPost(body, 'submitter-1');
    expect(m.submitVerifiedDependency).toHaveBeenCalledWith(ORG, body, 'submitter-1');
    expect(result).toEqual({ data: record });
  });

  const body = { dependentNodeId: 'a', dependsOnNodeId: 'b', processOrSystem: 'x', responsibleAuthority: 'x', evidenceReference: 'x' };

  it('answers a correctable submission error with 400', async () => {
    m.submitVerifiedDependency.mockRejectedValue(new m.VerifiedDependencyInputError('dependentNodeId and dependsOnNodeId must differ', 'same_node'));
    await expect(callPost(body)).rejects.toMatchObject({ status: 400, details: { code: 'same_node' } });
  });

  it('answers an unknown or ambiguous node reference with 409 - never guessing a node', async () => {
    m.submitVerifiedDependency.mockRejectedValue(new m.VerifiedDependencyInputError('matches more than one current node', 'node_reference_ambiguous'));
    await expect(callPost(body)).rejects.toMatchObject({ status: 409, details: { code: 'node_reference_ambiguous' } });
    m.submitVerifiedDependency.mockRejectedValue(new m.VerifiedDependencyInputError('no current node', 'node_not_current'));
    await expect(callPost(body)).rejects.toMatchObject({ status: 409, details: { code: 'node_not_current' } });
  });

  it('propagates an unexpected store failure unchanged', async () => {
    m.submitVerifiedDependency.mockRejectedValue(new Error('connection reset'));
    await expect(callPost(body)).rejects.toThrow('connection reset');
  });
});
