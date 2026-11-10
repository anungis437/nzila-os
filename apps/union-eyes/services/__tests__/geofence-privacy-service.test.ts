import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'selectDistinct', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete', 'onConflictDoUpdate',
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
    selectDistinct: vi.fn(() => makeChain()),
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
  or: vi.fn(() => ({})),
  ne: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));

import { GeofencePrivacyService } from '../geofence-privacy-service';
import { LOCATION_CONSENT_DESCRIPTION, LOCATION_CONSENT_PURPOSE, locationConsentNoticeDigest } from '@/lib/location/consent-notice';

const S = GeofencePrivacyService;
const ORG = 'org-1';
const EVENT_SCOPE = 'event-1';
const STRIKE_SCOPE = 'g1';
const eventScope = { linkedId: EVENT_SCOPE };
const strikeScope = { linkedId: 's1' };
const enabledConfig = (over: Record<string, unknown> = {}) => ({
  locationTrackingEnabled: true, backgroundTrackingAllowed: false,
  explicitOptInRequired: true, autoDeletionEnabled: true, ...over,
});

beforeEach(() => {
  h.queue.length = 0;
  process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = 'v1';
  process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = 'Approved exact notice';
});

describe('geofence-privacy-service', () => {
  describe('requestLocationConsent', () => {
    const req = { userId: 'u1', organizationId: ORG, scopeKind: 'event' as const, scopeId: EVENT_SCOPE, purpose: LOCATION_CONSENT_PURPOSE, purposeDescription: LOCATION_CONSENT_DESCRIPTION, consentText: 'Approved exact notice', noticeVersion: 'v1', allowedDuringEvents: true,
      noticeDigest: locationConsentNoticeDigest({ version: 'v1', purpose: LOCATION_CONSENT_PURPOSE, purposeDescription: LOCATION_CONSENT_DESCRIPTION, consentText: 'Approved exact notice' }) };

    it('refuses direct service callers who forge the notice or omit the configured policy', async () => {
      h.db.select.mockClear();
      await expect(S.requestLocationConsent({ ...req, consentText: 'I agree to a different purpose' }))
        .rejects.toThrow('notice unavailable or mismatched');
      await expect(S.requestLocationConsent({ ...req, noticeVersion: 'v0' }))
        .rejects.toThrow('notice unavailable or mismatched');
      // DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED: an acknowledgement of other wording under the same version.
      await expect(S.requestLocationConsent({ ...req, noticeDigest: 'f'.repeat(64) }))
        .rejects.toThrow('notice unavailable or mismatched');
      delete process.env.UE_LOCATION_CONSENT_NOTICE_TEXT;
      await expect(S.requestLocationConsent(req)).rejects.toThrow('notice unavailable or mismatched');
      expect(h.db.select).not.toHaveBeenCalled();
    });

    it('grants consent when none exists', async () => {
      pushSel([eventScope], [], [{ id: 'c1' }], []); // verified scope, existing empty, insert, audit
      const r = await S.requestLocationConsent(req);
      expect(r).toEqual({ id: 'c1' });
    });

    it('throws when an active consent already exists', async () => {
      pushSel([eventScope], [{ id: 'c0', consentStatus: 'opted_in', expiresAt: new Date('2999-01-01'), consentVersion: 'v1' }]);
      await expect(S.requestLocationConsent(req)).rejects.toThrow('already has active');
    });

    it('allows re-consent under a new notice version instead of trapping an old active consent', async () => {
      pushSel(
        [eventScope],
        [{ id: 'old', consentStatus: 'opted_in', consentVersion: 'v0', expiresAt: new Date('2999-01-01') }],
        [{ id: 'old', consentVersion: 'v1' }],
        [],
      );
      const r = await S.requestLocationConsent(req);
      expect(r).toEqual({ id: 'old', consentVersion: 'v1' });
    });

    it('renews an expired or withdrawn consent row in place with an upsert (user_id is unique)', async () => {
      pushSel(
        [eventScope],
        [{ id: 'c0', consentStatus: 'opted_in', expiresAt: new Date('2000-01-01') }], // existing expired
        [{ id: 'c0' }], // upsert returning (the conflict update applied)
        [], // audit
      );
      const r = await S.requestLocationConsent(req);
      expect(r).toEqual({ id: 'c0' });
    });

    it('refuses the renewal when a concurrent grant already made the consent active', async () => {
      pushSel(
        [eventScope],
        [{ id: 'c0', consentStatus: 'opted_out', expiresAt: null }],
        [], // the upsert predicate matched nothing
      );
      await expect(S.requestLocationConsent(req)).rejects.toThrow('already has active');
    });

    it('works on the caller\u2019s transaction when one is given', async () => {
      h.db.select.mockClear();
      const scopedRows = [[eventScope], []];
      const tx = {
        select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => scopedRows.shift() ?? [] }) }) })),
        insert: vi.fn(() => ({
          values: () => ({
            onConflictDoUpdate: () => ({ returning: async () => [{ id: 'cx' }] }),
          }),
        })),
      };
      const r = await S.requestLocationConsent(req, tx as never);
      expect(r).toEqual({ id: 'cx' });
      expect(h.db.select).not.toHaveBeenCalled();
    });
  });

  it('revokeLocationConsent updates, deletes data and logs, and reports the consent it revoked', async () => {
    pushSel(
      [{ id: 'c1' }], // update consent returning
      [{ id: 't1' }], // deleteAllUserLocationData tracking delete returning
      [{ id: 'e1' }], // events delete returning
      [], // deletion log insert
      [], // audit log
    );
    const r = await S.revokeLocationConsent('u1', ORG, 'because');
    expect(h.db.update).toHaveBeenCalled();
    expect(r.consentId).toBe('c1');
  });

  it('eraseLocationData removes tracking and event rows without needing any consent, and reports the total', async () => {
    pushSel([{ id: 't1' }, { id: 't2' }], [{ id: 'e1' }], []); // tracking delete, events delete, deletion log insert
    const r = await S.eraseLocationData('u1', ORG);
    expect(r).toEqual({ trackingRecordsDeleted: 2, eventRecordsDeleted: 1, total: 3 });
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it('revokeLocationConsent throws and deletes nothing when there is no consent to revoke', async () => {
    h.db.delete.mockClear();
    pushSel([]); // update matched nothing
    await expect(S.revokeLocationConsent('u1', ORG)).rejects.toThrow('No active location consent');
    expect(h.db.delete).not.toHaveBeenCalled();
  });

  describe('hasValidConsent', () => {
    it('returns false with no consent', async () => {
      pushSel([strikeScope], []);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(false);
    });

    it('expires and returns false when past expiry', async () => {
      pushSel([strikeScope], [{ id: 'c1', expiresAt: new Date('2000-01-01') }]);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(false);
    });

    it('returns false for strike context without strike permission', async () => {
      pushSel([strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: false }]);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(false);
    });

    it('returns false for event context without event permission', async () => {
      pushSel([eventScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringEvents: false }]);
      expect(await S.hasValidConsent('u1', ORG, 'event', EVENT_SCOPE)).toBe(false);
    });

    it('does not authorize tracking under a superseded or unconfigured notice', async () => {
      pushSel([strikeScope], [{ id: 'old', expiresAt: new Date('2999-01-01'), consentVersion: 'v0', allowedDuringStrike: true }]);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(false);
      delete process.env.UE_LOCATION_CONSENT_NOTICE_TEXT;
      pushSel([strikeScope], [{ id: 'current', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }]);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(false);
    });

    it('returns true for a valid consent', async () => {
      pushSel([strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }]);
      expect(await S.hasValidConsent('u1', ORG, 'strike', STRIKE_SCOPE)).toBe(true);
    });
  });

  describe('trackLocation', () => {
    const tr = { userId: 'u1', organizationId: ORG, latitude: 45.5, longitude: -73.5, purpose: 'strike', scopeKind: 'strike' as const, scopeId: STRIKE_SCOPE };

    it('throws without consent', async () => {
      pushSel([strikeScope], [strikeScope], []); // scope verification, hasValidConsent scope, no consent
      await expect(S.trackLocation(tr)).rejects.toThrow('explicit opt-in consent');
    });

    it('throws when tracking is globally disabled', async () => {
      pushSel(
        [strikeScope],
        [strikeScope],
        [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], // hasValidConsent
        [enabledConfig({ locationTrackingEnabled: false })], // getConfig
      );
      await expect(S.trackLocation(tr)).rejects.toThrow('globally disabled');
    });

    it('refuses a strike ping when the member did not allow tracking during strikes', async () => {
      pushSel([strikeScope], [strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: false }]);
      await expect(S.trackLocation(tr)).rejects.toThrow('explicit opt-in consent');
    });

    it('refuses unapproved purposes before any consent read or location write', async () => {
      h.db.select.mockClear();
      h.db.insert.mockClear();
      for (const purpose of ['meeting', 'organizing', 'arbitrary']) {
        await expect(S.trackLocation({ ...tr, purpose })).rejects.toThrow('not covered by the current consent');
      }
      expect(h.db.select).not.toHaveBeenCalled();
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('rejects a strike or event scope that the organization-bound resolver cannot verify', async () => {
      h.db.select.mockClear();
      h.db.insert.mockClear();
      pushSel([], []);
      await expect(S.trackLocation({ ...tr, scopeId: 'unknown-strike' })).rejects.toThrow('active organization strike');
      await expect(S.trackLocation({ ...tr, purpose: 'event', scopeKind: 'event', scopeId: 'unknown-event' })).rejects.toThrow('active organization event');
      expect(h.db.select).toHaveBeenCalledTimes(2);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('does not treat strike consent as event consent', async () => {
      pushSel([eventScope], [eventScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true, allowedDuringEvents: false }]);
      await expect(S.trackLocation({ ...tr, purpose: 'event', scopeKind: 'event', scopeId: EVENT_SCOPE })).rejects.toThrow('explicit opt-in consent');
    });

    it('does not auto-enable tracking when institutional configuration is absent', async () => {
      h.db.insert.mockClear();
      pushSel([strikeScope], [strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], []);
      await expect(S.trackLocation(tr)).rejects.toThrow('no approved configuration');
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('refuses enabled but privacy-unsafe configurations', async () => {
      for (const override of [{ backgroundTrackingAllowed: true }, { explicitOptInRequired: false }, { autoDeletionEnabled: false }]) {
        pushSel([strikeScope], [strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], [enabledConfig(override)]);
        await expect(S.trackLocation(tr)).rejects.toThrow('globally disabled');
      }
    });

    it('records a location point', async () => {
      pushSel(
        [strikeScope],
        [strikeScope],
        [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], // hasValidConsent
        [enabledConfig()], // getConfig
        [{ id: 'loc1' }], // insert returning
      );
      const r = await S.trackLocation(tr);
      expect(r).toEqual({ id: 'loc1' });
    });
  });

  it('createGeofence inserts and returns the fence scoped to the trusted union local', async () => {
    pushSel([{ id: 'g1' }]);
    const r = await S.createGeofence({ name: 'Hall', geofenceType: 'union_hall', centerLatitude: 45.5, centerLongitude: -73.5, radiusMeters: 100 }, 'org-1');
    expect(r).toEqual({ id: 'g1' });
  });

  describe('checkGeofenceEntry', () => {
    it('throws when the geofence is not found', async () => {
      pushSel([]);
      await expect(S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1')).rejects.toThrow('Geofence not found');
    });

    it('throws when the geofence belongs to a different union local (cross-tenant probe)', async () => {
      pushSel([{ id: 'g1', unionLocalId: 'org-2', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' }]);
      await expect(S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1')).rejects.toThrow('Geofence not found');
    });

    const fence = { id: 'g1', unionLocalId: 'org-1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' };

    it('reports inside and logs an entry event for a strike-linked fence with strike consent', async () => {
      pushSel(
        [{ ...fence, strikeId: 's1' }],
        [strikeScope],
        [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], // hasValidConsent
        [enabledConfig()], // getConfig
        [], // logGeofenceEvent insert
      );
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.recorded).toBe(true);
      expect(r.distance).toBeLessThan(1);
      expect(h.db.insert).toHaveBeenCalledTimes(1);
      // DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION: the event carries the fence's organization.
      const chain = h.db.insert.mock.results[0].value as { values: { mock: { calls: unknown[][] } } };
      expect(chain.values.mock.calls[0][0]).toMatchObject({ userId: 'u1', geofenceId: 'g1', organizationId: fence.unionLocalId });
    });

    // DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK
    it('reports inside but stores no position for a member who has not opted in', async () => {
      h.db.insert.mockClear();
      pushSel([fence]); // unlinked fence does not ask for consent
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('stores no position while location tracking is globally disabled', async () => {
      h.db.insert.mockClear();
      pushSel([{ ...fence, strikeId: 's1' }], [strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: true }], [enabledConfig({ locationTrackingEnabled: false })]);
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('asks for the strike permission when the fence belongs to a strike', async () => {
      h.db.insert.mockClear();
      pushSel([{ ...fence, strikeId: 's1' }], [strikeScope], [{ id: 'c1', expiresAt: new Date('2999-01-01'), consentVersion: 'v1', allowedDuringStrike: false }]);
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.recorded).toBe(false);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('does not record coordinates for an unlinked union-hall or safety-zone lookup', async () => {
      h.db.insert.mockClear();
      h.db.select.mockClear();
      pushSel([fence]);
      const r = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1');
      expect(r.inside).toBe(true);
      expect(r.recorded).toBe(false);
      expect(h.db.select).toHaveBeenCalledTimes(1);
      expect(h.db.insert).not.toHaveBeenCalled();
    });

    it('reports outside for a distant point', async () => {
      pushSel([{ id: 'g1', unionLocalId: 'org-1', centerLatitude: '45.50000000', centerLongitude: '-73.50000000', radiusMeters: '100' }]);
      const r = await S.checkGeofenceEntry('u1', 46.5, -74.5, 'g1', 'org-1');
      expect(r.inside).toBe(false);
      expect(r.distance).toBeGreaterThan(100);
    });
  });

  describe('deleteExpiredLocationData', () => {
    it('deletes each expired owner and logs when there are deletions', async () => {
      pushSel(
        [{ userId: 'u1' }],
        [{ userId: 'u2' }],
        [{ id: 't1' }],
        [],
        [],
        [{ id: 'e1' }],
        [],
      );
      const r = await S.deleteExpiredLocationData();
      expect(r.trackingRecordsDeleted).toBe(1);
      expect(r.eventRecordsDeleted).toBe(1);
      expect(r.truncated).toBe(false);
    });

    it('works off at most the per-run cap of members and says more remain', async () => {
      const cap = S.RETENTION_MAX_USERS_PER_RUN;
      const many = Array.from({ length: cap + 1 }, (_, i) => ({ userId: `u${i}` }));
      pushSel(many, []);
      const r = await S.deleteExpiredLocationData();
      expect(r.truncated).toBe(true);
    });

    it('does not log when there is nothing to delete', async () => {
      pushSel([], []);
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

    it('does not report compliance or auto-enable tracking when policy is missing', async () => {
      h.db.insert.mockClear();
      pushSel([]);
      await expect(S.verifyNoBackgroundTracking()).rejects.toThrow('no approved configuration');
      expect(h.db.insert).not.toHaveBeenCalled();
    });
  });

  describe('getRetentionStats', () => {
    it('summarizes active and expired records', async () => {
      pushSel([
        { expiresAt: new Date('2000-01-01'), recordedAt: new Date('1999-01-01') },
        { expiresAt: new Date('2999-01-01'), consentVersion: 'v1', recordedAt: new Date('2026-01-01') },
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

describe('geofence service authority boundary', () => {
  it('refuses a forged strike association before any geofence write', async () => {
    h.db.insert.mockClear();
    await expect(S.createGeofence({
      name: 'Picket', geofenceType: 'strike_line', centerLatitude: 45.5,
      centerLongitude: -73.6, radiusMeters: 50, strikeId: 'foreign-strike',
    }, 'org-1')).rejects.toThrow('organization-bound resolver');
    expect(h.db.insert).not.toHaveBeenCalled();
  });

  it('reads a geofence through the supplied tenant transaction, never the ambient db', async () => {
    h.db.select.mockClear();
    const fence = {
      id: 'g1', unionLocalId: 'org-1', centerLatitude: '45.50000000',
      centerLongitude: '-73.50000000', radiusMeters: '100',
    };
    const tx = {
      select: vi.fn(() => ({
        from: () => ({ where: () => ({ limit: async () => [fence] }) }),
      })),
    };
    const result = await S.checkGeofenceEntry('u1', 45.5, -73.5, 'g1', 'org-1', tx as any);
    expect(result).toMatchObject({ inside: true, recorded: false });
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(h.db.select).not.toHaveBeenCalled();
  });
});
