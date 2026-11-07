import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const written = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    notImplemented: (msg: string) => Object.assign(new Error(msg), { status: 501 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: () => () => { written.calls += 1; throw new Error('no database access expected'); } }) }));

// Gate 0 DEF-0B9-MOB-SYNC-PATH-REGISTERS-A-DEVICE-AND-SYNCS-NOTHING / DEF-0B9-MOB-TWO-DEVICE-TABLES: the sync path registered a device into a
// second table no sender reads and answered 200 although it synchronized nothing. It now answers 501 and writes nothing.
describe('mobile/sync POST', () => {
  it('answers 501 for synchronization and touches no table', async () => {
    const { POST } = await import('../route');
    await expect((POST as unknown as (ctx: unknown) => Promise<unknown>)({ userId: 'u1', organizationId: 'o1', body: { deviceId: 'd', platform: 'ios', deviceToken: 'tok-12345678' } }))
      .rejects.toMatchObject({ status: 501, message: expect.stringContaining('/api/mobile/devices') });
    expect(written.calls).toBe(0);
  });

  it('no longer inserts into mobile_devices or reads mobile_sync_queue anywhere in the route', () => {
    const source = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8');
    expect(source).not.toMatch(/\.insert\(|onConflictDoUpdate|mobileSyncQueue/);
  });
});
