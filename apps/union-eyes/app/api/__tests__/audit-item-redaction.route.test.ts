import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  rows: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
  predicates: [] as unknown[],
  scopes: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    m.options = options;
    return handler;
  },
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { code: 'FORBIDDEN' }),
    badRequest: (message: string) => Object.assign(new Error(message), { code: 'VALIDATION_ERROR' }),
    notFound: (message: string) => Object.assign(new Error(message), { code: 'NOT_FOUND' }),
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: (_column: unknown, value: unknown) => ({ value }),
  and: (...parts: unknown[]) => parts,
}));
vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: { auditId: 'audit_id', organizationId: 'organization_id' },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: (...args: unknown[]) => m.audit(...args),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (scope: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    const tx = {
      select: () => ({
        from: () => ({
          where: (predicate: unknown) => {
            m.predicates.push(predicate);
            return { limit: async () => m.rows };
          },
        }),
      }),
    };
    return callback(tx);
  },
}));

const org = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const ctx = { organizationId: org, userId: 'officer-1', params: { id } };

describe('audit item officer disclosure boundary', () => {
  beforeEach(() => {
    m.rows = [{
      auditId: id, organizationId: org, userId: 'private-member',
      action: 'case.updated', resourceType: 'grievances', resourceId: null,
      severity: 'info', outcome: 'success', createdAt: new Date('2026-10-01T12:00:00Z'),
      oldValues: { medicalRecord: 'private' }, newValues: { private: true },
      ipAddress: '10.0.0.1', userAgent: 'private agent', sessionId: 'private-session',
      metadata: { confidential: true }, errorMessage: 'sensitive',
    }];
    m.audit.mockReset().mockResolvedValue(undefined);
    m.scopes.length = 0;
    m.predicates.length = 0;
  });

  it('requires officer authorization and returns a redacted projection with mandatory read audit', async () => {
    const { GET } = await import('../audits/[id]/route');
    expect(m.options).toMatchObject({ auth: { minRole: 'officer' }, requireOrg: true });
    const result = await (GET as Function)(ctx);
    expect(result).toEqual({
      auditId: id, action: 'case.updated', resourceType: 'grievances',
      resourceId: null, severity: 'info', outcome: 'success',
      createdAt: new Date('2026-10-01T12:00:00Z'),
    });
    expect(m.scopes).toEqual([{ organizationId: org, userId: 'officer-1' }]);
    expect(m.predicates[0]).toEqual([{ value: id }, { value: org }]);
    expect(m.audit).toHaveBeenCalledOnce();
    expect(m.audit.mock.calls[0][1]).toMatchObject({
      organizationId: org, userId: 'officer-1', action: 'audit.entry.read',
      resourceType: 'audit_logs', resourceId: id,
    });
  });

  it('rejects missing organization context and malformed IDs without querying', async () => {
    const { GET } = await import('../audits/[id]/route');
    await expect((GET as Function)({ ...ctx, organizationId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect((GET as Function)({ ...ctx, params: { id: 'not-a-uuid' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(m.predicates).toHaveLength(0);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not reveal or audit a missing scoped row', async () => {
    m.rows = [];
    const { GET } = await import('../audits/[id]/route');
    await expect((GET as Function)(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('fails closed if read-audit persistence fails', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const { GET } = await import('../audits/[id]/route');
    await expect((GET as Function)(ctx)).rejects.toThrow('audit unavailable');
  });
});
