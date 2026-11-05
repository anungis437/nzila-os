import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, updated: [] as unknown[] }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => (m.row ? [m.row] : []) }) }) }),
      update: () => ({ set: (v: unknown) => ({ where: async () => { m.updated.push(v); } }) }),
    }),
  ),
}));

import { authenticateScimRequest, generateScimToken, hashScimToken, readBearerToken } from '../scim-token';

const request = (token?: string) =>
  new Request('http://localhost/api/scim/v2/o/Users', { headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('scim bearer token', () => {
  let token: string;
  beforeEach(() => {
    token = generateScimToken();
    m.updated = [];
    m.row = {
      id: 'cfg_1',
      organizationId: 'org_1',
      tokenHash: hashScimToken(token),
      enabled: true,
      syncUsers: true,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
    };
  });

  it('generates distinct, prefixed, high-entropy tokens and stores only a 64-hex SHA-256', () => {
    const a = generateScimToken();
    expect(a).toMatch(/^scim_[A-Za-z0-9_-]{43}$/);
    expect(generateScimToken()).not.toBe(a);
    expect(hashScimToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashScimToken(a)).not.toContain(a);
  });

  it('reads only a well-formed Bearer header', () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken('Basic abc')).toBeNull();
    expect(readBearerToken('Bearer short')).toBeNull();
    expect(readBearerToken(`Bearer ${token}`)).toBe(token);
  });

  it('authenticates a valid token for the organization that holds it, and records use', async () => {
    await expect(authenticateScimRequest(request(token))).resolves.toEqual({ ok: true, organizationId: 'org_1', configurationId: 'cfg_1', syncUsers: true });
    expect(m.updated).toHaveLength(1);
  });

  it('rejects a missing header, a wrong prefix and an unknown token', async () => {
    await expect(authenticateScimRequest(request())).resolves.toMatchObject({ ok: false, status: 401 });
    await expect(authenticateScimRequest(request('x'.repeat(40)))).resolves.toMatchObject({ ok: false, status: 401 });
    m.row = null;
    await expect(authenticateScimRequest(request(token))).resolves.toMatchObject({ ok: false, reason: 'invalid_token' });
    expect(m.updated).toHaveLength(0);
  });

  it('rejects a revoked token even when it is otherwise valid', async () => {
    m.row!.revokedAt = new Date();
    await expect(authenticateScimRequest(request(token))).resolves.toMatchObject({ ok: false, status: 401, reason: 'revoked' });
    expect(m.updated).toHaveLength(0);
  });

  it('rejects an expired token', async () => {
    m.row!.tokenExpiresAt = new Date(Date.now() - 1000);
    await expect(authenticateScimRequest(request(token))).resolves.toMatchObject({ ok: false, status: 401, reason: 'expired' });
  });

  it('answers 403 for a disabled configuration and does not record use', async () => {
    m.row!.enabled = false;
    await expect(authenticateScimRequest(request(token))).resolves.toMatchObject({ ok: false, status: 403, reason: 'disabled' });
    expect(m.updated).toHaveLength(0);
  });
});
