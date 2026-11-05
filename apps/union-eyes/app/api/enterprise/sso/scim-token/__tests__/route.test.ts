import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  existing: null as null | { id: string },
  inserted: null as unknown,
  updated: null as unknown,
  revoked: [] as unknown[],
  audits: [] as unknown[],
}));

const tx = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => (m.existing ? [m.existing] : []) }) }) }),
  insert: () => ({ values: (v: unknown) => { m.inserted = v; return { returning: async () => [{ id: 'cfg_new' }] }; } }),
  update: () => ({
    set: (v: unknown) => {
      m.updated = v;
      return { where: () => Object.assign(Promise.resolve(), { returning: async () => m.revoked }) };
    },
  }),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (request: Request, c: Record<string, unknown>) => handler({ ...c, request }),
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn(async (_c: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx)) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async (_t: unknown, e: unknown) => { m.audits.push(e); }) }));

import { DELETE, GET, POST } from '../route';

const ctx = { organizationId: 'org_1', userId: 'admin_1' };
const post = (body?: unknown) => new Request('http://localhost/api/enterprise/sso/scim-token', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

describe('scim token administration', () => {
  beforeEach(() => {
    m.existing = null;
    m.inserted = null;
    m.updated = null;
    m.revoked = [];
    m.audits = [];
  });

  it('issues a token once, stores only its hash, and audits the issue', async () => {
    const result = (await (POST as any)(post({}), ctx)) as { token: string; rotated: boolean };
    expect(result.token).toMatch(/^scim_/);
    expect(result.rotated).toBe(false);
    const stored = m.inserted as Record<string, unknown>;
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(result.token);
    expect(stored).toMatchObject({ organizationId: 'org_1', enabled: true, createdBy: 'admin_1' });
    expect(m.audits).toEqual([expect.objectContaining({ action: 'scim.token.issue', organizationId: 'org_1', userId: 'admin_1' })]);
  });

  it('rotates an existing configuration and clears any revocation', async () => {
    m.existing = { id: 'cfg_1' };
    const result = (await (POST as any)(post({ expiresInDays: 30 }), ctx)) as { rotated: boolean };
    expect(result.rotated).toBe(true);
    expect(m.updated).toMatchObject({ revokedAt: null, enabled: true, tokenLastUsedAt: null });
    expect(m.audits).toEqual([expect.objectContaining({ action: 'scim.token.rotate', resourceId: 'cfg_1' })]);
  });

  it.each([[{ expiresInDays: 0 }], [{ expiresInDays: 366 }], [{ expiresInDays: 1.5 }], [{ expiresInDays: '30' }]])('refuses an expiry of %j', async (body) => {
    await expect((POST as any)(post(body), ctx)).rejects.toMatchObject({ status: 400 });
    expect(m.inserted).toBeNull();
    expect(m.audits).toHaveLength(0);
  });

  it('GET reports status and never a token or its hash', async () => {
    m.existing = { id: 'cfg_1', tokenHash: 'a'.repeat(64), enabled: true } as never;
    const result = await (GET as any)(new Request('http://localhost/x'), ctx);
    expect(result).toMatchObject({ configured: true, enabled: true });
    expect(JSON.stringify(result)).not.toContain('a'.repeat(64));
  });

  it('DELETE revokes and disables, auditing the revocation', async () => {
    m.revoked = [{ id: 'cfg_1' }];
    await expect((DELETE as any)(new Request('http://localhost/x', { method: 'DELETE' }), ctx)).resolves.toEqual({ revoked: true });
    expect(m.updated).toMatchObject({ enabled: false });
    expect(m.audits).toEqual([expect.objectContaining({ action: 'scim.token.revoke' })]);
  });

  it('DELETE answers 404 when nothing is configured and audits nothing', async () => {
    await expect((DELETE as any)(new Request('http://localhost/x', { method: 'DELETE' }), ctx)).rejects.toMatchObject({ status: 404 });
    expect(m.audits).toHaveLength(0);
  });
});
