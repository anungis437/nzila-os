import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const sendMock = vi.fn(async () => ({ id: 'n1' }));
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
  return { queue, db, sendMock };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/provincial-privacy-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/db/schema/organization-members-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/notification-service', () => ({
  NotificationService: class { send = h.sendMock; },
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
}));

import { ProvincialPrivacyService } from '../provincial-privacy-service';

const S = ProvincialPrivacyService;

beforeEach(() => {
  h.queue.length = 0;
  h.sendMock.mockClear();
});

describe('provincial-privacy-service', () => {
  describe('getProvinceConfig', () => {
    it('returns a stored config when present', async () => {
      pushSel([{ province: 'QC', lawName: 'stored' }]);
      const r = await S.getProvinceConfig('QC');
      expect(r.lawName).toBe('stored');
    });

    it('falls back to the default QC config', async () => {
      pushSel([]);
      const r = await S.getProvinceConfig('QC');
      expect(r.explicitOptIn).toBe(true);
    });

    it('falls back to PIPEDA default for other provinces', async () => {
      pushSel([]);
      const r = await S.getProvinceConfig('MB');
      expect(r.lawName).toContain('PIPEDA');
    });
  });

  describe('recordConsent', () => {
    const base = {
      userId: 'u1', province: 'QC' as const, consentType: 'marketing', consentGiven: true,
      consentMethod: 'explicit', consentText: 't', consentLanguage: 'en' as const,
    };

    it('rejects implied consent in Quebec', async () => {
      pushSel([]); // getProvinceConfig → default QC (explicitOptIn true)
      await expect(S.recordConsent({ ...base, consentMethod: 'implied_action' })).rejects.toThrow('explicit consent');
    });

    it('defaults QC consent language to fr and records consent', async () => {
      pushSel([], [{ id: 'c1', consentLanguage: 'fr' }]); // default config, insert
      const r = await S.recordConsent(base);
      expect(r).toEqual({ id: 'c1', consentLanguage: 'fr' });
    });

    it('records consent for a non-QC province', async () => {
      pushSel([], [{ id: 'c2' }]);
      const r = await S.recordConsent({ ...base, province: 'BC', consentType: 'analytics' });
      expect(r).toEqual({ id: 'c2' });
    });
  });

  describe('hasValidConsent', () => {
    it('returns false when there is no consent', async () => {
      pushSel([]);
      expect(await S.hasValidConsent('u1', 'QC', 'marketing')).toBe(false);
    });

    it('returns false when the latest consent is revoked', async () => {
      pushSel([{ revokedAt: new Date() }]);
      expect(await S.hasValidConsent('u1', 'QC', 'marketing')).toBe(false);
    });

    it('returns false when consent has expired', async () => {
      pushSel([{ revokedAt: null, expiresAt: new Date('2000-01-01') }]);
      expect(await S.hasValidConsent('u1', 'QC', 'marketing')).toBe(false);
    });

    it('returns true for a valid consent', async () => {
      pushSel([{ revokedAt: null, expiresAt: new Date('2999-01-01') }]);
      expect(await S.hasValidConsent('u1', 'QC', 'marketing')).toBe(true);
    });
  });

  it('revokeConsent updates the consent record', async () => {
    pushSel([]);
    await S.revokeConsent('u1', 'QC', 'marketing');
    expect(h.db.update).toHaveBeenCalled();
  });

  describe('reportBreach', () => {
    const base = {
      breachType: 'unauthorized_access', severity: 'low' as const, affectedUserCount: 1,
      dataTypes: ['email'], breachDescription: 'd', reportedBy: 'admin',
    };

    it('records a breach without urgent notification', async () => {
      pushSel([{ id: 'b1' }]); // insert returning
      const r = await S.reportBreach({ ...base, discoveredAt: new Date() });
      expect(r).toEqual({ id: 'b1' });
      expect(h.sendMock).not.toHaveBeenCalled();
    });

    it('flags regulator notification for sensitive data and triggers urgent notification near deadline', async () => {
      const discoveredAt = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50h ago → deadline ~22h away
      pushSel(
        [{ id: 'b2' }], // insert returning
        [{ id: 'b2', breachType: 'x', severity: 'critical', discoveredAt, notificationDeadline: new Date(), affectedUserCount: '600' }], // trigger: select breach
        [{ organizationId: 'org1' }], // orgMember
      );
      const r = await S.reportBreach({ ...base, severity: 'critical', dataTypes: ['sin'], affectedUserCount: 600, discoveredAt });
      expect(r).toEqual({ id: 'b2' });
      expect(h.sendMock).toHaveBeenCalledOnce();
    });

    it('returns early when the breach reporter has no organization', async () => {
      const discoveredAt = new Date(Date.now() - 50 * 60 * 60 * 1000);
      pushSel(
        [{ id: 'b3' }], // insert
        [{ id: 'b3', breachType: 'x', severity: 'high', discoveredAt, notificationDeadline: new Date(), affectedUserCount: '5' }], // select breach
        [], // orgMember empty
      );
      await S.reportBreach({ ...base, severity: 'high', discoveredAt });
      expect(h.sendMock).not.toHaveBeenCalled();
    });
  });

  describe('markBreachNotificationSent', () => {
    it('marks user notification and computes deadline met', async () => {
      pushSel([], [{ notificationDeadline: new Date('2999-01-01') }], []); // update, select, update deadlineMet
      await S.markBreachNotificationSent('b1', 'users');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('marks regulator notification', async () => {
      pushSel([], [{ notificationDeadline: new Date('2000-01-01') }], []);
      await S.markBreachNotificationSent('b1', 'regulator');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('handles a missing breach record', async () => {
      pushSel([], []); // update, select empty (no second update)
      await S.markBreachNotificationSent('b1', 'users');
      expect(h.db.update).toHaveBeenCalled();
    });
  });

  it('logDataHandling inserts an audit record', async () => {
    pushSel([]);
    await S.logDataHandling({
      userId: 'u1', province: 'ON', actionType: 'access', dataCategory: 'pii',
      purpose: 'support', legalBasis: 'consent', performedBy: 'admin',
    });
    expect(h.db.insert).toHaveBeenCalled();
  });

  it('createDSAR inserts a request and returns it', async () => {
    pushSel([{ id: 'dsar1' }]);
    const r = await S.createDSAR({ userId: 'u1', requestType: 'access', province: 'QC' });
    expect(r).toEqual({ id: 'dsar1' });
  });

  describe('updateDSARStatus', () => {
    it('updates a non-completed status', async () => {
      pushSel([]);
      await S.updateDSARStatus('dsar1', 'in_progress', 'agent');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('updates a completed status and checks the deadline', async () => {
      pushSel([{ responseDeadline: new Date('2999-01-01') }], []); // select dsar, update
      await S.updateDSARStatus('dsar1', 'completed');
      expect(h.db.update).toHaveBeenCalled();
    });
  });

  it('getOverdueDSARs queries pending overdue requests', async () => {
    pushSel([{ id: 'dsar1' }]);
    expect(await S.getOverdueDSARs()).toHaveLength(1);
  });

  it('getBreachesApproachingDeadline queries un-notified breaches', async () => {
    pushSel([{ id: 'b1' }]);
    expect(await S.getBreachesApproachingDeadline()).toHaveLength(1);
  });
});
