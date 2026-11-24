import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

// #1116: the audit history of an organization is tenant content. The list readers (/api/audits and the compliance audit-log list) serve
// it only to a live, direct administrator of the organization in context; a platform title or an ancestor's administration is not enough.

const ORG = '11111111-1111-4111-8111-111111111111';

const m = vi.hoisted(() => ({
  options: new Map<string, Record<string, unknown>>(),
  direct: new Map<string, string>(),
  resolveOrganizationAccess: vi.fn(),
  listAuditEntries: vi.fn(),
  persistAtomicAudit: vi.fn(),
  scopes: [] as unknown[],
  rows: [] as unknown[],
  transactions: [] as unknown[],
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    withApi: (options: Record<string, unknown>, handler: unknown) => {
      m.options.set(String((options as { auth?: { minRole?: string } }).auth?.minRole) + ':' + m.options.size, options);
      return handler;
    },
    ApiError,
    z,
  };
});
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  directRoleIn: (access: { direct: Map<string, string> }, organizationId: string) => access.direct.get(organizationId),
  isAdministrativeRole: (role: string | undefined) => role === 'admin' || role === 'president',
}));
vi.mock('@/lib/audit/audit-reader', () => ({ listAuditEntries: m.listAuditEntries }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema/audit-security-schema', () => ({ auditLogs: {} }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc') }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (scope: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    const chain: Record<string, unknown> = {};
    for (const name of ['from', 'where', 'orderBy']) chain[name] = () => chain;
    chain.limit = async () => m.rows;
    const tx = { select: () => chain };
    m.transactions.push(tx);
    return fn(tx);
  }),
}));

type Handler = (context: Record<string, unknown>) => Promise<unknown>;
const ctx = (over: Record<string, unknown> = {}) => ({ organizationId: ORG, userId: 'user_1', ...over });

const routes: Array<[string, () => Promise<Handler>]> = [
  ['/api/audits', async () => (await import('../audits/route')).GET as unknown as Handler],
  ['/api/compliance/audit-logs', async () => (await import('../compliance/audit-logs/route')).GET as unknown as Handler],
];

describe('audit-log list readers require direct administration of the organization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.scopes = [];
    m.rows = [];
    m.transactions = [];
    m.direct = new Map([[ORG, 'admin']]);
    m.resolveOrganizationAccess.mockImplementation(async () => ({ platform: false, direct: m.direct, descendants: new Set() }));
    m.listAuditEntries.mockResolvedValue([]);
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('asks the framework for an administrator on both readers', async () => {
    for (const [, load] of routes) await load();
    const minRoles = [...m.options.values()].map((options) => (options.auth as { minRole: string }).minRole);
    expect(minRoles).not.toContain('officer');
    expect(minRoles.every((role) => role === 'admin')).toBe(true);
  });

  it.each(routes)('%s serves a live, direct administrator of the organization, inside the tenant context', async (_path, load) => {
    const GET = await load();
    await GET(ctx());
    expect(m.resolveOrganizationAccess).toHaveBeenCalledWith('user_1');
    expect(m.scopes).toEqual([{ organizationId: ORG, userId: 'user_1' }]);
  });

  it.each(routes)('%s refuses a platform administrator with no direct membership, before anything is read', async (_path, load) => {
    const GET = await load();
    m.resolveOrganizationAccess.mockResolvedValueOnce({ platform: true, direct: new Map(), descendants: new Set() });
    await expect(GET(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.scopes).toEqual([]);
    expect(m.listAuditEntries).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it.each(routes)('%s refuses an administrator of a parent organization, and an officer or member of this one', async (_path, load) => {
    const GET = await load();
    for (const direct of [new Map([['parent_org', 'admin']]), new Map([[ORG, 'officer']]), new Map([[ORG, 'member']])]) {
      m.resolveOrganizationAccess.mockResolvedValueOnce({ platform: false, direct, descendants: new Set([ORG]) });
      await expect(GET(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(m.scopes).toEqual([]);
  });

  it.each(routes)('%s refuses a caller with no user identity', async (_path, load) => {
    const GET = await load();
    await expect(GET(ctx({ userId: null }))).rejects.toBeInstanceOf(ApiError);
    expect(m.scopes).toEqual([]);
  });

  it('the compliance list uses the same store-aware redacted reader as audit history and audits the read on that transaction', async () => {
    const GET = (await import('../compliance/audit-logs/route')).GET as unknown as Handler;
    const rows = [{
      auditId: '22222222-2222-4222-8222-222222222222', action: 'configuration.updated',
      resourceType: 'organization', resourceId: ORG, userId: 'user_1',
      severity: null, outcome: null, createdAt: new Date('2026-11-23T12:00:00Z'), source: 'canonical',
    }];
    m.listAuditEntries.mockResolvedValue(rows);
    expect(await GET(ctx())).toEqual(rows);
    expect(m.listAuditEntries).toHaveBeenCalledWith(m.transactions[0], ORG);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.transactions[0], {
      organizationId: ORG, userId: 'user_1', action: 'compliance.audit_log.read',
      resourceType: 'audit_logs', resourceId: ORG, details: { count: 1 },
    });
  });

  it('the compliance list fails closed if either the store read or its mandatory read-audit fails', async () => {
    const GET = (await import('../compliance/audit-logs/route')).GET as unknown as Handler;
    m.listAuditEntries.mockRejectedValueOnce(new Error('canonical audit store unavailable'));
    await expect(GET(ctx())).rejects.toThrow('canonical audit store unavailable');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    m.listAuditEntries.mockResolvedValueOnce([]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('mandatory read audit unavailable'));
    await expect(GET(ctx())).rejects.toThrow('mandatory read audit unavailable');
  });
});
