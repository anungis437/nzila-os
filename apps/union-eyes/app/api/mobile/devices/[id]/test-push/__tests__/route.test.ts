// DEF-0B9-MOB-TWO-DEVICE-TABLES-NO-ROUTE-REMOVES-A-DEVICE-AND-NO-SENDER-READS-EITHER: a route now reads push_devices and sends through the
// sender. It finds only the caller's own device, answers 501 rather than pretending to send without a provider, and audits each attempt.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  updates: [] as unknown[],
  audits: [] as Array<{ entry: Record<string, unknown>; outcome: string }>,
  where: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    capabilityUnavailable: (msg: string) => Object.assign(new Error(msg), { status: 501 }),
    externalService: (svc: string, msg: string) => Object.assign(new Error(`${svc}: ${msg}`), { status: 502 }),
  },
}));
vi.mock('@/db/schema', () => ({ pushDevices: { id: 'id', deviceToken: 'deviceToken', enabled: 'enabled', organizationId: 'organizationId', profileId: 'profileId' } }));
vi.mock('drizzle-orm', () => ({ eq: (col: string, val: unknown) => ({ col, val }), and: (...parts: unknown[]) => parts }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const tx = {
  select: () => ({ from: () => ({ where: (w: unknown) => { m.where.push(w); return { limit: async () => m.rows }; } }) }),
  update: () => ({ set: (v: unknown) => ({ where: async () => { m.updates.push(v); } }) }),
};
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_c: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx) }));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>, outcome = 'success') => { m.audits.push({ entry, outcome }); },
}));

const { sendTestPush } = await import('../route');
const DEVICE = '33333333-3333-4333-8333-333333333333';
const args = { organizationId: 'org-1', userId: 'member-1', deviceId: DEVICE };

describe('POST /api/mobile/devices/[id]/test-push', () => {
  beforeEach(() => {
    m.rows = [{ id: DEVICE, deviceToken: 'secret-token', enabled: true }];
    m.updates = []; m.audits = []; m.where = [];
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  });

  it('looks the device up by id, organization and the caller as owner, and answers 404 for anything else', async () => {
    m.rows = [];
    await expect(sendTestPush(args)).rejects.toMatchObject({ status: 404 });
    expect(JSON.stringify(m.where)).toContain('"col":"profileId","val":"member-1"');
    expect(JSON.stringify(m.where)).toContain('"col":"organizationId","val":"org-1"');
    await expect(sendTestPush({ ...args, deviceId: 'not-a-uuid' })).rejects.toMatchObject({ status: 404 });
    expect(m.audits).toHaveLength(0);
  });

  it('answers 501 and sends nothing without a provider, auditing the failed attempt without the token', async () => {
    await expect(sendTestPush(args)).rejects.toMatchObject({ status: 501 });
    expect(m.audits).toEqual([{ entry: expect.objectContaining({ action: 'mobile.device.test_push', details: { outcome: 'provider_not_configured' } }), outcome: 'failure' }]);
    expect(JSON.stringify(m.audits)).not.toContain('secret-token');
  });

  it('answers 409 for a switched-off device without contacting the provider', async () => {
    m.rows = [{ id: DEVICE, deviceToken: 'secret-token', enabled: false }];
    const transport = vi.fn();
    await expect(sendTestPush(args, transport)).rejects.toMatchObject({ status: 409 });
    expect(transport).not.toHaveBeenCalled();
  });

  it('reports a delivery only when the provider accepted it', async () => {
    expect(await sendTestPush(args, async () => 'msg-1')).toEqual({ sent: true, providerMessageId: 'msg-1' });
    expect(m.audits[0]).toMatchObject({ outcome: 'success', entry: { details: { outcome: 'sent' } } });
  });

  it('switches off a device whose token the provider rejects, and answers 502 for any other provider failure', async () => {
    await expect(sendTestPush(args, async () => { throw Object.assign(new Error('x'), { code: 'messaging/registration-token-not-registered' }); })).rejects.toMatchObject({ status: 409 });
    expect(m.updates).toEqual([expect.objectContaining({ enabled: false })]);
    m.updates = [];
    await expect(sendTestPush(args, async () => { throw Object.assign(new Error('x'), { code: 'messaging/internal-error' }); })).rejects.toMatchObject({ status: 502 });
    expect(m.updates).toEqual([]);
  });
});
