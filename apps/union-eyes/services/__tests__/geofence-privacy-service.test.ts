import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
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
  return { queue, db };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/geofence-privacy-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));

import { GeofencePrivacyService } from '../geofence-privacy-service';

const S = GeofencePrivacyService;
const enabledConfig = (over: Record<string, unknown> = {}) => ({ locationTrackingEnabled: true, backgroundTrackingAllowed: false, ...over });

beforeEach(() => {
  h.queue.length = 0;
});

describe('geofence-privacy-service', () => {
  describe('requestLocationConsent', () => {
    const req = { userId: 'u1', purpose: 'strike', purposeDescription: 'd', consentText: 't' };

    it('grants consent when none exists', async () => {
      pushSel([], [{ id: 'c1' }], []); // existing empty, insert, audit
      const r = await S.requestLocationConsent(req);
      expect(r).toEqual({ id: 'c1' });
    });

    it('throws when an active consent already exists', async () => {
      pushSel([{ id: 'c0', consentStatus: 'opted_in', expiresAt: new Date('2999-01-01') }]);
      await expect(S.requestLocationConsent(req)).rejects.toThrow('already has active');
    });

    it('expires a stale consent and creates a new one', async () => {
      pushSel(
        [{ id: 'c0', consentStatus: 'opted_in', expiresAt: new Date('2000-01-01') }], // existing expired
        [], // expireConsent update
        [{ id: 'c1' }], // insert new
        [], // audit
      );
      const r = await S.requestLocationConsent(req);
      expect(r).toEqual({ id: 'c1' });
    });
  });

  it('revokeLocationConsent updates, deletes data and logs', async () => {
    pushSel(
      [], // update consent
      [{ id: 't1' }], // deleteAllUserLocationData tracking delete returning
      [{ id: 'e1' }], // events delete returning
      [], // deletion log insert
      [], // audit log
    );
    await S.revokeLocationConsent('u1', 'because');
    expect(h.db.update).toHaveBeenCalled();
  });

  describe('hasValidConsent', () => {
    it('returns false with no consent', async () => {
      pushSel([]);
      expect(await S.hasValidConsent('u1')).toBe(false);
    });

    it('expires and returns false when past expiry', async () => {
      pushSel([{ id: 'c1', expiresAt: new Date('2000-01-01') }], []);
      expect(await S.hasValidConsent('u1')).toBe(false);
    });

    it('returns false for strike context without strike permission', async () => {
      pushSel([{ id: 'c1', expiresAt: new Date('2999-01-01'), allowedDuringStrike: false }]);
      expect(await S.hasValidConsent('u1', 'strike')).toBe(false);
    });

    it('returns false for event context without event permission', async () => {
      pushSel([{ id: 'c1', expiresAt: new Date('2999-01-01'), allowedDuringEvents: false }]);
      expect(await S.hasValidConsent('u1', 'event')).toBe(false);
    });

    it('returns true for a valid consent', async () => {
      pushSel([{ id: 'c1', expiresAt: new Date('2999-01-01'), allowedDuringStrike: true }]);
      expect(await S.hasValidConsent('u1', 'strike')).toBe(true);
    });
  });

  describe('trackLocation', () => {
    const tr = { userId: 'u1', latitude: 45.5, longitude: -73.5, purpose: 'strike' };

    it('throws without consent', async () => {
      pushSel([]); // hasValidConsent → none
      await expect(S.trackLocation(tr)).rejects.toThrow('explicit opt-in consent');
    });

    it('throws when tracking is globally disabled', async () => {
      pushSel(
        [{ id: 'c1', expiresAt: new Date('2999-01-01') }], // hasValidConsent
        [enabledConfig({ locationTrackingEnabled: false })], // getConfig
      );
      await expect(S.trackLocation(tr)).rejects.toThrow('globally disabled');
    });

    it('records a location point', async () => {
      pushSel(
        [{ id: 'c1', expiresAt: new Date('2999-01-01') }], // hasValidConsent
        [enabledConfig()], // getConfig
        [{ id: 'loc1' }], // insert returning
      );
      const r = await S.trackLocation(tr);
      expect(r).toEqual({ id: 'loc1' });
    });
  });

  it('createGeofence inserts and returns the fence', async () => {
    pushSel([{ id: 'g1' }]);
    const r = await S.createGeofence({ name: 'Hall', geofenceType: 'union_hall', centerLatitude: 45.5, centerLongitude: -73.5, radiusMeters: 100 });
    expect(r).toEqual({ id: 'g1' });
  });

  describe('checkGeofenceEntry', () => {
    it('throws when the geofence is not found', async () => {
      pushSel([]);
      await expect(S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1')).rejects.toThrow('Geofence not found');
    });

    it('reports inside and logs an entry event', async () => {
      pushSel(
        [{ id: 'g1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' }],
        [], // logGeofenceEvent insert
      );
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1');
      expect(r.inside).toBe(true);
      expect(r.distance).toBeLessThan(1);
    });

    it('reports outside for a distant point', async () => {
      pushSel([{ id: 'g1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' }]);
      const r = await S.checkGeofenceEntry('u1', 46.5, -74.5, 'g1');
      expect(r.inside).toBe(false);
      expect(r.distance).toBeGreaterThan(100);
    });
  });

  describe('deleteExpiredLocationData', () => {
    it('deletes expired records and logs when there are deletions', async () => {
      pushSel([{ id: 't1' }], [{ id: 'e1' }], []); // tracking delete, events delete, deletion log
      const r = await S.deleteExpiredLocationData();
      expect(r.trackingRecordsDeleted).toBe(1);
      expect(r.eventRecordsDeleted).toBe(1);
    });

    it('does not log when there is nothing to delete', async () => {
      pushSel([], []); // both deletes empty, no log
      const r = await S.deleteExpiredLocationData();
      expect(r.trackingRecordsDeleted).toBe(0);
      expect(r.eventRecordsDeleted).toBe(0);
    });
  });

  describe('verifyNoBackgroundTracking', () => {
    it('reports compliance when nothing is background', async () => {
      pushSel(
        [enabledConfig()], // getConfig
        [], // backgroundConsents
        [], // backgroundTracking
      );
      const r = await S.verifyNoBackgroundTracking();
      expect(r.compliant).toBe(true);
    });

    it('reports all violations', async () => {
      pushSel(
        [enabledConfig({ backgroundTrackingAllowed: true })], // getConfig
        [{ id: 'c1' }], // backgroundConsents
        [{ id: 't1' }], // backgroundTracking
      );
      const r = await S.verifyNoBackgroundTracking();
      expect(r.compliant).toBe(false);
      expect(r.violations).toHaveLength(3);
    });

    it('creates a default config when none exists', async () => {
      pushSel(
        [], // getConfig select empty
        [enabledConfig()], // getConfig insert default
        [], // backgroundConsents
        [], // backgroundTracking
      );
      const r = await S.verifyNoBackgroundTracking();
      expect(r.compliant).toBe(true);
    });
  });

  describe('getRetentionStats', () => {
    it('summarizes active and expired records', async () => {
      pushSel([
        { expiresAt: new Date('2000-01-01'), recordedAt: new Date('1999-01-01') },
        { expiresAt: new Date('2999-01-01'), recordedAt: new Date('2026-01-01') },
      ]);
      const r = await S.getRetentionStats();
      expect(r.totalRecords).toBe(2);
      expect(r.activeRecords).toBe(1);
      expect(r.expiredRecords).toBe(1);
    });

    it('handles an empty record set', async () => {
      pushSel([]);
      const r = await S.getRetentionStats();
      expect(r.totalRecords).toBe(0);
      expect(r.oldestRecord).toBeNull();
      expect(r.newestRecord).toBeNull();
    });
  });
});
