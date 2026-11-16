import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DEF-0B6-CMP-FIREWALL-POLICY-NO-WRITER-OR-ENFORCER: the route was the generic factory over data_classification_policy, a platform table no route
// writes and nothing enforces, under the name of an employer data firewall. It answers 501 and no longer binds the table at all, so the
// writeRole question this test used to pin (compliance_manager, never the per-org admin) has no write to protect.
describe('compliance/data-classification-policy route (platform classification doctrine)', () => {
  const source = readFileSync(resolve(__dirname, '../../compliance/data-classification-policy/route.ts'), 'utf8');

  it('answers 501 and binds neither the factory nor the table', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).not.toMatch(/crudRoutes\(/);
    expect(source).not.toMatch(/dataClassificationPolicy/);
  });

  it('exports the same methods it did, all refused', () => {
    expect(source).toContain('export const GET = handler');
    expect(source).toContain('export const POST = handler');
  });
});
// Governance Officer 2.1 P0-D: privacy workflow routes must never be bound to
// classification-policy CRUD. Breach/jurisdictional workflows remain unavailable;
// DSAR now uses the subject's persistent request store and private conversation.
describe.each(['breach', 'dsar', 'provincial'])('privacy/%s route misbinding containment', (name) => {
  const source = readFileSync(resolve(__dirname, `../${name}/route.ts`), 'utf8');

  it('does not import the classification policy table or the CRUD factory', () => {
    expect(source).not.toMatch(/from ['"]@\/db\/schema['"]/);
    expect(source).not.toMatch(/from ['"]@\/lib\/api\/crud-factory['"]/);
    expect(source).not.toMatch(/crudRoutes\(/);
  });

  if (name !== 'dsar') {
    it('fails closed with NOT_IMPLEMENTED for every method', () => {
      expect(source).toMatch(/ApiError\.notImplemented\(MESSAGE\)/);
      expect(source).toMatch(/export const GET/);
      expect(source).toMatch(/export const POST/);
    });
  }
});

const mocks = vi.hoisted(() => ({ rls: vi.fn(), list: vi.fn(), create: vi.fn(), log: vi.fn() }));
// The shared withApi authentication contract has its own real-wrapper tests.
// These calls exercise the actual privacy transaction boundary and route response.
vi.mock('@/lib/api/framework', () => ({ withApi: (_config: unknown, handler: unknown) => handler }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.rls }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.log, warn: mocks.log, info: mocks.log } }));
vi.mock('@/lib/privacy/requests', () => ({
  listPrivacyRequests: mocks.list, createPrivacyRequest: mocks.create,
  PrivacyRequestError: class extends Error {},
}));
type Context = { userId: string | null; organizationId: string | null; request?: Request };
async function get(context: Context): Promise<Response> {
  const route = await import('../dsar/route');
  return (route.GET as unknown as (context: Context) => Promise<Response>)(context);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rls.mockImplementation((_context: unknown, work: (tx: unknown) => unknown) => work({ controlledTransaction: true }));
  mocks.list.mockResolvedValue([]);
});

describe('privacy/dsar subject-bound transaction boundary', () => {
  it('refuses missing identity/organization and stale organization before any database operation', async () => {
    expect((await get({ userId: null, organizationId: 'org-A' })).status).toBe(403);
    expect((await get({ userId: 'subject', organizationId: null })).status).toBe(403);
    expect((await get({ userId: 'subject', organizationId: 'org-A', request: new Request('https://app.example/api/privacy/dsar', { headers: { 'x-ue-expected-organization': 'org-B' } }) })).status).toBe(409);
    expect(mocks.rls).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('passes only the authenticated subject and organization into the own-request service', async () => {
    const response = await get({ userId: 'subject', organizationId: 'org-A' });
    expect(response.status).toBe(200);
    expect(mocks.rls).toHaveBeenCalledWith({ organizationId: 'org-A' }, expect.any(Function));
    expect(mocks.list).toHaveBeenCalledWith({ controlledTransaction: true }, { userId: 'subject', organizationId: 'org-A' });
    expect((await response.json()).data.requests).toEqual([]);
  });

  it('answers unavailable when the transaction or audit refuses, without leaking private SQL parameters', async () => {
    mocks.list.mockRejectedValueOnce(new Error('SQL parameter: PRIVATE-REQUEST-TEXT'));
    const response = await get({ userId: 'subject', organizationId: 'org-A' });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('PRIVATE-REQUEST-TEXT');
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain('PRIVATE-REQUEST-TEXT');
  });
});
