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
vi.mock('@/db/schema/indigenous-data-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

import { IndigenousDataService } from '../indigenous-data-service';

const S = IndigenousDataService;

beforeEach(() => {
  h.queue.length = 0;
});

describe('indigenous-data-service', () => {
  describe('registerBandCouncil', () => {
    const reg = { bandName: 'B', bandNumber: '123', province: 'ON', region: 'R', onReserveStorageEnabled: true };

    it('registers a new band council', async () => {
      pushSel([], [{ id: 'bc1' }]);
      const r = await S.registerBandCouncil(reg);
      expect(r).toEqual({ id: 'bc1' });
    });

    it('throws when the band number already exists', async () => {
      pushSel([{ id: 'bc1' }]);
      await expect(S.registerBandCouncil(reg)).rejects.toThrow('already registered');
    });
  });

  describe('recordBandCouncilConsent', () => {
    const consent = { bandCouncilId: 'bc1', consentType: 'member_data_view', purposeOfCollection: 'p', dataCategories: ['a'], intendedUse: 'u', approvedBy: 'chief' };

    it('records consent for an existing council', async () => {
      pushSel([{ id: 'bc1' }], [{ id: 'c1' }]);
      const r = await S.recordBandCouncilConsent(consent);
      expect(r).toEqual({ id: 'c1' });
    });

    it('throws when the band council does not exist', async () => {
      pushSel([]);
      await expect(S.recordBandCouncilConsent(consent)).rejects.toThrow('Band Council not found');
    });
  });

  describe('hasBandCouncilConsent', () => {
    it('returns false when there is no consent', async () => {
      pushSel([]);
      expect(await S.hasBandCouncilConsent('bc1', 'member_data_view')).toBe(false);
    });

    it('returns false when the latest consent is revoked', async () => {
      pushSel([{ revokedAt: new Date() }]);
      expect(await S.hasBandCouncilConsent('bc1', 'member_data_view')).toBe(false);
    });

    it('returns false when the consent has expired', async () => {
      pushSel([{ revokedAt: null, expiresAt: new Date('2000-01-01') }]);
      expect(await S.hasBandCouncilConsent('bc1', 'member_data_view')).toBe(false);
    });

    it('returns true for a valid current consent', async () => {
      pushSel([{ revokedAt: null, expiresAt: new Date('2999-01-01') }]);
      expect(await S.hasBandCouncilConsent('bc1', 'member_data_view')).toBe(true);
    });
  });

  describe('registerIndigenousMember', () => {
    it('registers a Status Indian with a valid band council', async () => {
      pushSel([{ id: 'bc1' }], [{ id: 'm1' }]);
      const r = await S.registerIndigenousMember({ userId: 'u1', indigenousStatus: 'Status Indian', bandCouncilId: 'bc1' });
      expect(r).toEqual({ id: 'm1' });
    });

    it('throws when the band council is missing for a Status Indian', async () => {
      pushSel([]);
      await expect(S.registerIndigenousMember({ userId: 'u1', indigenousStatus: 'Status Indian', bandCouncilId: 'bc1' })).rejects.toThrow('Band Council not found');
    });

    it('registers a non-status member without band council lookup', async () => {
      pushSel([{ id: 'm2' }]);
      const r = await S.registerIndigenousMember({ userId: 'u2', indigenousStatus: 'Métis' });
      expect(r).toEqual({ id: 'm2' });
    });
  });

  describe('getStorageLocation', () => {
    it('returns null when the member is not found', async () => {
      pushSel([]);
      expect(await S.getStorageLocation('u1')).toBeNull();
    });

    it('returns the on-reserve location when enabled', async () => {
      pushSel(
        [{ onReserveDataOnly: true, bandCouncilId: 'bc1', preferredStorageLocation: 'cloud' }],
        [{ onReserveStorageEnabled: true, storageLocation: 'reserve-server' }],
      );
      expect(await S.getStorageLocation('u1')).toBe('reserve-server');
    });

    it('falls back to the preferred location otherwise', async () => {
      pushSel(
        [{ onReserveDataOnly: true, bandCouncilId: 'bc1', preferredStorageLocation: 'cloud' }],
        [{ onReserveStorageEnabled: false, storageLocation: null }],
      );
      expect(await S.getStorageLocation('u1')).toBe('cloud');
    });

    it('returns the preferred location when on-reserve is not required', async () => {
      pushSel([{ onReserveDataOnly: false, preferredStorageLocation: 'cloud' }]);
      expect(await S.getStorageLocation('u1')).toBe('cloud');
    });
  });

  it('logDataAccess inserts an audit entry', async () => {
    pushSel([{ bandCouncilId: 'bc1' }], []);
    await S.logDataAccess({
      userId: 'u1',
      accessedBy: 'admin',
      accessType: 'view',
      accessPurpose: 'p',
      dataCategories: ['a'],
      authorizedBy: 'individual_consent',
    });
    expect(h.db.insert).toHaveBeenCalled();
  });

  describe('isAccessAuthorized', () => {
    it('denies when the member is not found', async () => {
      pushSel([]);
      const r = await S.isAccessAuthorized('u1', 'view', 'admin');
      expect(r.authorized).toBe(false);
      expect(r.reason).toContain('not found');
    });

    it('allows self-access', async () => {
      pushSel([{ userId: 'u1' }]);
      const r = await S.isAccessAuthorized('u1', 'view', 'u1');
      expect(r.authorized).toBe(true);
    });

    it('denies third-party access when not allowed', async () => {
      pushSel([{ allowThirdPartyAccess: false }]);
      const r = await S.isAccessAuthorized('u1', 'view', 'admin');
      expect(r.authorized).toBe(false);
      expect(r.reason).toContain('third-party');
    });

    it('denies aggregation when not allowed', async () => {
      pushSel([{ allowThirdPartyAccess: true, allowAggregation: false }]);
      const r = await S.isAccessAuthorized('u1', 'aggregate', 'admin');
      expect(r.authorized).toBe(false);
      expect(r.reason).toContain('aggregation');
    });

    it('denies when band-council consent is required but missing', async () => {
      pushSel(
        [{ allowThirdPartyAccess: true, dataControlPreference: 'band_council', bandCouncilId: 'bc1' }],
        [], // hasBandCouncilConsent → no consent
      );
      const r = await S.isAccessAuthorized('u1', 'view', 'admin');
      expect(r.authorized).toBe(false);
      expect(r.reason).toContain('Band Council consent');
    });

    it('authorizes when all checks pass', async () => {
      pushSel(
        [{ allowThirdPartyAccess: true, dataControlPreference: 'band_council', bandCouncilId: 'bc1' }],
        [{ revokedAt: null, expiresAt: null }],
      );
      const r = await S.isAccessAuthorized('u1', 'view', 'admin');
      expect(r.authorized).toBe(true);
    });
  });

  it('createSharingAgreement inserts and returns the agreement', async () => {
    pushSel([{ id: 'ag1' }]);
    const r = await S.createSharingAgreement({
      bandCouncilId: 'bc1',
      partnerName: 'P',
      partnerType: 'gov',
      agreementTitle: 'T',
      agreementDescription: 'D',
      dataSharingScope: {},
      purposeLimitation: 'pl',
      validFrom: new Date(),
      approvedBy: 'chief',
    });
    expect(r).toEqual({ id: 'ag1' });
  });

  it('getActiveSharingAgreements returns active agreements', async () => {
    pushSel([{ id: 'ag1' }]);
    expect(await S.getActiveSharingAgreements('bc1')).toEqual([{ id: 'ag1' }]);
  });

  describe('registerTraditionalKnowledge', () => {
    it('registers public knowledge', async () => {
      pushSel([{ id: 'tk1' }]);
      const r = await S.registerTraditionalKnowledge({ bandCouncilId: 'bc1', knowledgeType: 'song', knowledgeTitle: 'T', sensitivityLevel: 'public' });
      expect(r).toEqual({ id: 'tk1' });
    });

    it('registers sacred knowledge with elder approval default', async () => {
      pushSel([{ id: 'tk2' }]);
      const r = await S.registerTraditionalKnowledge({ bandCouncilId: 'bc1', knowledgeType: 'ritual', knowledgeTitle: 'T', sensitivityLevel: 'sacred' });
      expect(r).toEqual({ id: 'tk2' });
    });
  });

  describe('validateOCAPCompliance', () => {
    const params = { userId: 'u1', operationType: 'view', requestedBy: 'admin', purpose: 'p' };

    it('fails when the member is not registered', async () => {
      pushSel([]);
      const r = await S.validateOCAPCompliance(params);
      expect(r.compliant).toBe(false);
      expect(r.violations[0]).toContain('Ownership');
    });

    it('flags control, access and possession violations', async () => {
      pushSel(
        [{ dataControlPreference: 'band_council', bandCouncilId: 'bc1', onReserveDataOnly: true, allowThirdPartyAccess: false }], // member (validateOCAP)
        [], // hasBandCouncilConsent (control) → no consent
        [{ dataControlPreference: 'band_council', bandCouncilId: 'bc1', allowThirdPartyAccess: false }], // isAccessAuthorized member lookup
        // isAccessAuthorized: third-party not allowed → returns early (no further consent query)
        [], // getStorageLocation member lookup → not found → null
      );
      const r = await S.validateOCAPCompliance(params);
      expect(r.compliant).toBe(false);
      expect(r.violations.some(v => v.includes('Control'))).toBe(true);
      expect(r.violations.some(v => v.includes('Access'))).toBe(true);
      expect(r.violations.some(v => v.includes('Possession'))).toBe(true);
    });

    it('passes when all OCAP checks succeed', async () => {
      pushSel(
        [{ dataControlPreference: 'individual', bandCouncilId: null, onReserveDataOnly: false }], // member (validateOCAP)
        [{ allowThirdPartyAccess: true, dataControlPreference: 'individual' }], // isAccessAuthorized member lookup
        [{ onReserveDataOnly: false, preferredStorageLocation: 'cloud' }], // getStorageLocation member lookup
      );
      const r = await S.validateOCAPCompliance(params);
      expect(r.compliant).toBe(true);
      expect(r.violations).toHaveLength(0);
    });
  });
});
