import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  audit: vi.fn(),
  tx: { insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ governancePolicies: { organizationId: 'organizationId', createdAt: 'createdAt' } }));

describe('governance/policies/rules POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx));
    m.tx.insert.mockReturnValue({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'p1', title: 'Policy' }]) })),
    });
    m.audit.mockResolvedValue(undefined);
  });

  it('creates the rule and its audit record in the same transaction', async () => {
    const { POST } = await import('../governance/policies/rules/route');
    const result = await (POST as any)({ body: { title: 'Policy' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ id: 'p1', title: 'Policy' });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'governance.policy_rule.create', resourceId: 'p1' }),
    );
  });

  it('does not report success when the audit write fails', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import('../governance/policies/rules/route');

    await expect((POST as any)({ body: { title: 'Policy' }, organizationId: 'org_1', userId: 'u1' })).rejects.toThrow('audit down');
  });
});
