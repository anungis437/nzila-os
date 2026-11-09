import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  createNodeAlias: vi.fn(),
  listAllNodeAliases: vi.fn(),
  hasMinRole: vi.fn(async () => true),
}));

vi.mock('@/lib/knowledge-transfer/propagation/node-alias-store', () => ({
  createNodeAlias: m.createNodeAlias,
  listAllNodeAliases: m.listAllNodeAliases,
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    ApiError: {
      forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
      badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    },
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
  };
});

const ORG = 'org-1';

async function callGet() {
  const { GET } = await import('../route');
  return (GET as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: ORG });
}

async function callPost(body: Record<string, unknown>, userId = 'u1') {
  const { POST } = await import('../route');
  return (POST as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: ORG, userId, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.hasMinRole.mockResolvedValue(true);
});

describe('GET /api/exit-interviews/node-aliases', () => {
  it('lists the full alias history for the organization', async () => {
    const aliases = [{ id: 'a1', aliasLabel: 'payroll clerk', canonicalConceptLabel: 'payroll_specialist' }];
    m.listAllNodeAliases.mockResolvedValue(aliases);
    const result = await callGet();
    expect(m.listAllNodeAliases).toHaveBeenCalledWith(ORG);
    expect(result).toEqual({ data: aliases });
  });
});

describe('POST /api/exit-interviews/node-aliases', () => {
  it('records a new alias when the caller meets the national_officer+ floor', async () => {
    const alias = { id: 'a1', aliasLabel: 'payroll clerk', canonicalConceptLabel: 'payroll_specialist' };
    m.createNodeAlias.mockResolvedValue(alias);
    const body = { aliasLabel: 'payroll clerk', canonicalConceptLabel: 'payroll_specialist', reason: 'title standardized' };
    const result = await callPost(body, 'reviewer-1');
    expect(m.hasMinRole).toHaveBeenCalledWith('national_officer');
    expect(m.createNodeAlias).toHaveBeenCalledWith(ORG, body, 'reviewer-1');
    expect(result).toEqual({ data: alias });
  });

  it('refuses a caller below the national_officer+ floor without recording anything', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const body = { aliasLabel: 'payroll clerk', canonicalConceptLabel: 'payroll_specialist', reason: 'x' };
    await expect(callPost(body)).rejects.toThrow(/national_officer/);
    expect(m.createNodeAlias).not.toHaveBeenCalled();
  });

  it('wraps a store rejection (e.g. self-referential alias) as a bad-request error', async () => {
    m.createNodeAlias.mockRejectedValue(new Error('aliasLabel and canonicalConceptLabel must differ'));
    const body = { aliasLabel: 'payroll_specialist', canonicalConceptLabel: 'payroll_specialist', reason: 'x' };
    await expect(callPost(body)).rejects.toThrow(/must differ/);
  });
});
