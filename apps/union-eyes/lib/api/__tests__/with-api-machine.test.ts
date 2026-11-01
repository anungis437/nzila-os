/**
 * withApi() auth.machine: a machine caller (an identity provider, a scanner) is authenticated by its own credential, not by a user session.
 *
 * A route that declared "no authentication required" and checked its token by hand looked public to every control that reads the declaration.
 * Declaring the credential makes the route's authentication a fact the framework runs: the verifier decides who the caller is, no session is
 * read or attached, and a route cannot mix it with user authentication.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetCurrentUser, mockCheckRateLimit } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: mockGetCurrentUser };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { withApi } from '../with-api';
import { ApiError } from '../errors';

const request = (url = 'http://localhost:3000/api/machine/org-1') => new NextRequest(new URL(url), { headers: { authorization: 'Bearer token-1' } });
const params = (organizationId = 'org-1') => ({ params: Promise.resolve({ organizationId }) });

describe('withApi auth.machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'session-user', email: 'a@example.test', role: 'admin', organizationId: 'org-session' });
  });

  it('runs the verifier with the request and the route params and hands who it verified to the handler', async () => {
    const authenticate = vi.fn(async (_request: NextRequest, p: Record<string, string>) => ({ organizationId: p.organizationId, configurationId: 'cfg-1' }));
    const handler = vi.fn(async ({ machine }: { machine: { organizationId: string; configurationId: string } }) => ({ acted: machine.organizationId, by: machine.configurationId }));
    const route = withApi({ auth: { machine: authenticate } }, handler as never);

    const response = await route(request(), params());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ acted: 'org-1', by: 'cfg-1' });
    expect(authenticate).toHaveBeenCalledWith(expect.any(NextRequest), { organizationId: 'org-1' });
  });

  it('reads no user session and attaches no user, even when the caller also carries one', async () => {
    let seen: { user: unknown; userId: unknown; organizationId: unknown } | null = null;
    const route = withApi({ auth: { machine: async () => ({ ok: true }) } }, (async (ctx: { user: unknown; userId: unknown; organizationId: unknown }) => {
      seen = { user: ctx.user, userId: ctx.userId, organizationId: ctx.organizationId };
      return { done: true };
    }) as never);

    expect((await route(request(), params())).status).toBe(200);
    expect(seen).toEqual({ user: null, userId: null, organizationId: null });
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown credential', ApiError.unauthorized('Invalid token'), 401],
    ['a disabled configuration', ApiError.forbidden('Not enabled'), 403],
    ['an organization the credential is not for', ApiError.notFound('Organization'), 404],
    ['a caller over its limit', ApiError.rateLimited(30), 429],
  ])('refuses %s before the handler runs, and a session cannot stand in for the credential', async (_label, error, status) => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ auth: { machine: async () => { throw error; } } }, handler as never);

    const response = await route(request(), params());
    expect(response.status).toBe(status);
    expect(handler).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it('answers a verifier that fails unexpectedly as a server fault, never as success, and does not run the handler', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ auth: { machine: async () => { throw new Error('lookup exploded'); } } }, handler as never);

    expect((await route(request(), params())).status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses at registration to mix a machine credential with user authentication, so it is never unclear which one decides', () => {
    const verifier = async () => ({});
    const noop = (async () => ({})) as never;
    expect(() => withApi({ auth: { machine: verifier, minRole: 'admin' } }, noop)).toThrow('cannot be combined');
    expect(() => withApi({ auth: { machine: verifier, roles: ['admin'] } }, noop)).toThrow('cannot be combined');
    expect(() => withApi({ auth: { machine: verifier, cron: true } }, noop)).toThrow('cannot be combined');
    expect(() => withApi({ auth: { machine: verifier, required: true } }, noop)).toThrow('cannot be combined');
    expect(() => withApi({ auth: { machine: verifier } }, noop)).not.toThrow();
  });

  it('gives an ordinary route no machine caller', async () => {
    let machine: unknown = 'unset';
    const route = withApi({ auth: { required: false } }, (async (ctx: { machine: unknown }) => { machine = ctx.machine; return { ok: true }; }) as never);
    await route(request(), params());
    expect(machine).toBeUndefined();
  });
});
