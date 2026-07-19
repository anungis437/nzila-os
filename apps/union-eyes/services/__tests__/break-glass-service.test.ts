import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  process.env.UE_BREAK_GLASS_SHARE_MASTER_KEY = 'a'.repeat(64);

  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  const notifSend = vi.fn(async () => { throw new Error('notify fail'); });
  return { queue, db, notifSend };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/force-majeure-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('secrets.js-grempe', () => ({ default: { share: vi.fn(() => ['s1', 's2', 's3', 's4', 's5']) } }));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: class { send = h.notifSend; } }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));

import { BreakGlassService } from '../break-glass-service';

const S = BreakGlassService;

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

describe('break-glass-service', () => {
  describe('initializeBreakGlassSystem', () => {
    it('rejects when not exactly 5 key holders are provided', async () => {
      await expect(S.initializeBreakGlassSystem({
        scenarioType: 's', scenarioDescription: 'd', keyHolderIds: ['a', 'b'], estimatedRecoveryTime: '48h',
      })).rejects.toThrow('5 key holders');
    });

    it('initializes the system and generates encrypted shares', async () => {
      pushSel([{ id: 'sys1' }], [], [], [], [], []); // insert system, 5 keyholder inserts
      const r = await S.initializeBreakGlassSystem({
        scenarioType: 's', scenarioDescription: 'd',
        keyHolderIds: ['k1', 'k2', 'k3', 'k4', 'k5'], estimatedRecoveryTime: '48h',
      });
      expect(r).toEqual({ id: 'sys1' });
    });
  });

  describe('activateEmergency', () => {
    const act = { scenarioType: 's', activationReason: 'fire', emergencyLevel: 'critical' as const, activatedBy: 'admin' };

    it('throws when there is no active system', async () => {
      pushSel([]);
      await expect(S.activateEmergency(act)).rejects.toThrow('No active break-glass system');
    });

    it('creates an activation record and notifies key holders', async () => {
      pushSel(
        [{ id: 'sys1' }], // active system
        [{ id: 'act1' }], // insert activation
        [], // update system status
        [{ emergencyPhone: '+15551234567', emergencyEmail: 'kh@x.com' }], // notifyKeyHolders select
      );
      const r = await S.activateEmergency(act);
      expect(r).toEqual({ id: 'act1' });
      expect(h.notifSend).toHaveBeenCalled();
    });
  });

  describe('submitSignature', () => {
    const sig = { keyHolderId: 'kh1', ipAddress: '1.1.1.1' };

    it('throws when the key holder is not registered', async () => {
      pushSel([]);
      await expect(S.submitSignature('act1', sig)).rejects.toThrow('Key holder not found');
    });

    it('throws when the activation is not found', async () => {
      pushSel([{ userId: 'kh1' }], []);
      await expect(S.submitSignature('act1', sig)).rejects.toThrow('Activation not found');
    });

    it('throws when the key holder already signed', async () => {
      pushSel([{ userId: 'kh1' }], [{ signature1UserId: 'kh1', signaturesReceived: 1 }]);
      await expect(S.submitSignature('act1', sig)).rejects.toThrow('already signed');
    });

    it('records a signature without completing authorization', async () => {
      pushSel([{ userId: 'kh1' }], [{ signaturesReceived: 0 }], []);
      const r = await S.submitSignature('act1', sig);
      expect(r.authorizationComplete).toBe(false);
      expect(r.signaturesReceived).toBe(1);
    });

    it('completes authorization and runs recovery on the third signature', async () => {
      pushSel([{ userId: 'kh1' }], [{ signaturesReceived: 2 }], [], []); // keyHolder, activation, update, recovery update
      const r = await S.submitSignature('act1', sig);
      expect(r.authorizationComplete).toBe(true);
      expect(r.signaturesReceived).toBe(3);
    });
  });

  it('scheduleDrill inserts a drill record', async () => {
    pushSel([{ id: 'd1' }]);
    const r = await S.scheduleDrill({
      drillName: 'Q1', drillType: 'tabletop_exercise', scenarioType: 's',
      scheduledDate: new Date(), participants: ['a'], objectives: ['o'], targetRecoveryTime: '48h', conductedBy: 'admin',
    });
    expect(r).toEqual({ id: 'd1' });
  });

  it('completeDrill updates drill results and next-test schedule', async () => {
    pushSel([], []); // update drill, update system
    await S.completeDrill('d1', {
      actualStartTime: new Date('2026-01-01T00:00:00Z'),
      actualEndTime: new Date('2026-01-01T02:30:00Z'),
      actualRecoveryTime: '2h30m', objectivesMet: ['o'], overallScore: 90,
    });
    expect(h.db.update).toHaveBeenCalledTimes(2);
  });

  it('getOverdueDrills queries active overdue systems', async () => {
    pushSel([{ id: 'sys1' }]);
    expect(await S.getOverdueDrills()).toHaveLength(1);
  });

  it('registerColdStorageBackup inserts a storage record', async () => {
    pushSel([{ id: 'cs1' }]);
    const r = await S.registerColdStorageBackup({
      vaultProvider: 'swiss', vaultLocation: 'zurich', storageType: 'cold', dataCategory: 'db', encryptedBy: 'admin',
    });
    expect(r).toEqual({ id: 'cs1' });
  });

  it('defineRTO inserts a recovery time objective', async () => {
    pushSel([{ id: 'rto1' }]);
    const r = await S.defineRTO({
      systemComponent: 'db', rtoHours: 4, rpoHours: 1, criticalityLevel: 'critical',
    });
    expect(r).toEqual({ id: 'rto1' });
  });

  it('getActiveKeyHolders returns active holders', async () => {
    pushSel([{ userId: 'kh1' }]);
    expect(await S.getActiveKeyHolders()).toHaveLength(1);
  });

  it('getKeyHoldersNeedingTraining returns holders past training expiry', async () => {
    pushSel([{ userId: 'kh1' }]);
    expect(await S.getKeyHoldersNeedingTraining()).toHaveLength(1);
  });
});
