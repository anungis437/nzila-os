/**
 * Indigenous Data Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  indigenousMemberDataFindFirst: vi.fn(),
  bandCouncilConsentFindFirst: vi.fn(),
  bandCouncilConsentFindMany: vi.fn(),
  bandCouncilsFindFirst: vi.fn(),
  bandCouncilsFindMany: vi.fn(),
  accessLogFindMany: vi.fn(),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db', () => ({
  db: {
    query: {
      indigenousMemberData: { findFirst: mocks.indigenousMemberDataFindFirst },
      bandCouncilConsent: {
        findFirst: mocks.bandCouncilConsentFindFirst,
        findMany: mocks.bandCouncilConsentFindMany,
      },
      bandCouncils: {
        findFirst: mocks.bandCouncilsFindFirst,
        findMany: mocks.bandCouncilsFindMany,
      },
      indigenousDataAccessLog: { findMany: mocks.accessLogFindMany },
    },
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema', () => ({
  bandCouncils: { id: 'id', onReserveStorageEnabled: 'onReserveStorageEnabled' },
  bandCouncilConsent: { id: 'id', bandCouncilId: 'bandCouncilId', consentGiven: 'consentGiven', expiresAt: 'expiresAt' },
  indigenousMemberData: { userId: 'userId', bandCouncilId: 'bandCouncilId' },
  indigenousDataAccessLog: { userId: 'userId', createdAt: 'createdAt' },
}));

vi.mock('@/db/schema/indigenous-data-schema', () => ({
  indigenousMemberData: { userId: 'userId', bandCouncilId: 'bandCouncilId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid-abcd') }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { IndigenousDataService, setupOnPremiseStorage } from '../indigenous-data-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('IndigenousDataService', () => {
  let service: IndigenousDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IndigenousDataService();
    mocks.mockInsert.mockReturnValue(chain(undefined));
    mocks.mockUpdate.mockReturnValue(chain(undefined));
  });

  // ── verifyBandCouncilOwnership ─────────────────────────────────────────────
  describe('verifyBandCouncilOwnership', () => {
    it('returns no agreement when member not found', async () => {
      mocks.indigenousMemberDataFindFirst.mockResolvedValue(undefined);
      const result = await service.verifyBandCouncilOwnership('nonexistent');
      expect(result.hasAgreement).toBe(false);
      expect(result.reason).toContain('not associated');
    });

    it('returns no agreement when member has no band council', async () => {
      mocks.indigenousMemberDataFindFirst.mockResolvedValue({ userId: 'm-1', bandCouncilId: null });
      const result = await service.verifyBandCouncilOwnership('m-1');
      expect(result.hasAgreement).toBe(false);
    });

    it('returns agreement when active consent exists', async () => {
      mocks.indigenousMemberDataFindFirst.mockResolvedValue({ userId: 'm-1', bandCouncilId: 'bc-1' });
      mocks.bandCouncilConsentFindFirst.mockResolvedValue({ id: 'consent-1', consentGiven: true, expiresAt: null });
      mocks.bandCouncilsFindFirst.mockResolvedValue({ id: 'bc-1', bandName: 'Test Band' });

      const result = await service.verifyBandCouncilOwnership('m-1');
      expect(result.hasAgreement).toBe(true);
      expect(result.bandName).toBe('Test Band');
      expect(result.agreementId).toBe('consent-1');
    });

    it('handles database error gracefully', async () => {
      mocks.indigenousMemberDataFindFirst.mockRejectedValue(new Error('DB fail'));
      const result = await service.verifyBandCouncilOwnership('m-1');
      expect(result.hasAgreement).toBe(false);
      expect(result.reason).toContain('Database error');
    });
  });

  // ── requestDataAccess ──────────────────────────────────────────────────────
  describe('requestDataAccess', () => {
    it('creates request for standard data', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ bandCouncilId: 'bc-1' }]));
      const result = await service.requestDataAccess('user-1', 'membership', 'Report', 'standard');
      expect(result.status).toBe('pending');
      expect(result.requiresBandCouncilApproval).toBe(false);
      expect(result.requiresElderApproval).toBe(false);
    });

    it('throws when no band council for sensitive data', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      await expect(
        service.requestDataAccess('user-1', 'health', 'Review', 'sensitive'),
      ).rejects.toThrow('Band Council approval required');
    });

    it('sets elder approval for sacred data', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ bandCouncilId: 'bc-1' }]));
      const result = await service.requestDataAccess('user-1', 'teachings', 'Study', 'sacred');
      expect(result.requiresBandCouncilApproval).toBe(true);
      expect(result.requiresElderApproval).toBe(true);
    });
  });

  // ── checkAccessPermission ──────────────────────────────────────────────────
  describe('checkAccessPermission', () => {
    it('allows standard data', async () => {
      const result = await service.checkAccessPermission('user-1', 'info', 'standard');
      expect(result.hasAccess).toBe(true);
    });

    it('denies sensitive data without approval', async () => {
      const result = await service.checkAccessPermission('user-1', 'health', 'sensitive');
      expect(result.hasAccess).toBe(false);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('denies unknown sensitivity', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await service.checkAccessPermission('user-1', 'x', 'unknown' as any);
      expect(result.hasAccess).toBe(false);
    });
  });

  // ── routeToStorage ─────────────────────────────────────────────────────────
  describe('routeToStorage', () => {
    it('routes to on-premise when available', async () => {
      mocks.bandCouncilsFindFirst.mockResolvedValue({
        onReserveStorageEnabled: true,
        storageLocation: 'https://server.local',
        dataResidencyRequired: true,
      });
      const result = await service.routeToStorage({}, 'reserve-1', 'membership');
      expect(result.storageLocation).toBe('on_premise');
    });

    it('routes to cloud when no on-premise', async () => {
      mocks.bandCouncilsFindFirst.mockResolvedValue({
        onReserveStorageEnabled: false,
        storageLocation: null,
        dataResidencyRequired: true,
      });
      const result = await service.routeToStorage({}, 'reserve-1', 'membership');
      expect(result.storageLocation).toBe('cloud_encrypted');
    });
  });

  // ── getStorageConfig ───────────────────────────────────────────────────────
  describe('getStorageConfig', () => {
    it('returns config from database', async () => {
      mocks.bandCouncilsFindFirst.mockResolvedValue({
        onReserveStorageEnabled: true,
        storageLocation: 'https://server.local',
        dataResidencyRequired: true,
      });
      const config = await service.getStorageConfig('reserve-1');
      expect(config.hasOnPremiseServer).toBe(true);
      expect(config.storageLocation).toBe('canada_only');
    });

    it('returns defaults when not found', async () => {
      mocks.bandCouncilsFindFirst.mockResolvedValue(null);
      const config = await service.getStorageConfig('unknown');
      expect(config.hasOnPremiseServer).toBe(false);
    });

    it('handles error gracefully', async () => {
      mocks.bandCouncilsFindFirst.mockRejectedValue(new Error('DB fail'));
      const config = await service.getStorageConfig('reserve-1');
      expect(config.hasOnPremiseServer).toBe(false);
    });
  });

  // ── classifyData ───────────────────────────────────────────────────────────
  describe('classifyData', () => {
    it('classifies sacred content', async () => {
      const result = await service.classifyData('knowledge', 'Ancient ceremony teachings');
      expect(result.sensitivity).toBe('sacred');
      expect(result.requiresElderApproval).toBe(true);
    });

    it('classifies sensitive content', async () => {
      const result = await service.classifyData('record', 'Confidential health records');
      expect(result.sensitivity).toBe('sensitive');
    });

    it('classifies PII content', async () => {
      const result = await service.classifyData('id', 'SIN number 123-456-789');
      expect(result.sensitivity).toBe('sensitive');
    });

    it('classifies standard content', async () => {
      const result = await service.classifyData('note', 'General announcement');
      expect(result.sensitivity).toBe('standard');
    });
  });

  // ── requestElderApproval ───────────────────────────────────────────────────
  describe('requestElderApproval', () => {
    it('returns pending request', async () => {
      const result = await service.requestElderApproval('data-1', 'user-1', 'Research');
      expect(result.status).toBe('pending');
      expect(result.requestId).toBeDefined();
    });
  });

  // ── logDataAccess ──────────────────────────────────────────────────────────
  describe('logDataAccess', () => {
    it('inserts access log', async () => {
      await service.logDataAccess('user-1', 'admin-1', 'view', 'Audit', ['membership'], 'band_council_consent');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── generateComplianceReport ───────────────────────────────────────────────
  describe('generateComplianceReport', () => {
    it('returns OCAP compliance report', async () => {
      mocks.bandCouncilConsentFindMany.mockResolvedValue([{ id: 'c-1' }]);
      mocks.bandCouncilsFindMany
        .mockResolvedValueOnce([]) // with storage
        .mockResolvedValueOnce([{ id: 'bc-1' }]); // all

      const report = await service.generateComplianceReport();
      expect(report.bandCouncilAgreements).toBe(1);
      expect(report.ocapPrinciples.ownership.compliant).toBe(true);
    });
  });

  // ── exportDataForBandCouncil ───────────────────────────────────────────────
  describe('exportDataForBandCouncil', () => {
    it('returns export with record count', async () => {
      mocks.accessLogFindMany.mockResolvedValue([{ id: 'log-1' }, { id: 'log-2' }]);
      const result = await service.exportDataForBandCouncil('Test Band', ['membership'], new Date('2026-01-01'), new Date());
      expect(result.recordCount).toBe(2);
      expect(result.encrypted).toBe(true);
    });
  });

  // ── registerBandCouncil ────────────────────────────────────────────────────
  describe('registerBandCouncil', () => {
    it('registers and returns id', async () => {
      const result = await service.registerBandCouncil({
        bandName: 'Test Band', bandNumber: '001', province: 'Ontario', region: 'Central',
      });
      expect(result.success).toBe(true);
      expect(result.bandCouncilId).toBeDefined();
    });
  });

  // ── updateBandCouncilConsent ───────────────────────────────────────────────
  describe('updateBandCouncilConsent', () => {
    it('creates consent record', async () => {
      const result = await service.updateBandCouncilConsent('bc-1', {
        consentType: 'data_access', consentGiven: true, purposeOfCollection: 'Research',
        dataCategories: ['health'], intendedUse: 'Analysis', approvedBy: 'chief-1',
      });
      expect(result.success).toBe(true);
    });
  });

  // ── getMemberAccessHistory ─────────────────────────────────────────────────
  describe('getMemberAccessHistory', () => {
    it('returns access logs', async () => {
      mocks.accessLogFindMany.mockResolvedValue([{ id: 'log-1' }]);
      const result = await service.getMemberAccessHistory('user-1');
      expect(result).toHaveLength(1);
    });
  });

  // ── revokeConsent ──────────────────────────────────────────────────────────
  describe('revokeConsent', () => {
    it('revokes consent', async () => {
      const result = await service.revokeConsent('consent-1', 'No longer needed');
      expect(result.success).toBe(true);
    });
  });
});

// ── setupOnPremiseStorage ────────────────────────────────────────────────────
describe('setupOnPremiseStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUpdate.mockReturnValue(chain(undefined));
  });

  it('configures on-premise storage', async () => {
    const result = await setupOnPremiseStorage('reserve-1', 'https://server.local', 'admin@band.ca');
    expect(result.success).toBe(true);
    expect(result.config?.hasOnPremiseServer).toBe(true);
  });
});

/* ── Batch 32: branch gap-fill ── */

describe('IndigenousDataService (branch gaps)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockInsert.mockReturnValue(chain(undefined));
    mocks.mockSelect.mockReturnValue(chain([]));
    mocks.mockUpdate.mockReturnValue(chain(undefined));
  });

  it('verifyBandCouncilOwnership returns false on DB error', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.indigenousMemberDataFindFirst.mockRejectedValue(new Error('DB error'));
    const result = await svc.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(false);
    expect(result.reason).toContain('Database error');
  });

  it('verifyBandCouncilOwnership returns bandName from bandCouncil lookup', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.indigenousMemberDataFindFirst.mockResolvedValue({
      bandCouncilId: 'bc-1',
      userId: 'member-1',
    });
    mocks.bandCouncilConsentFindFirst.mockResolvedValue({
      id: 'consent-1',
      expiresAt: null,
    });
    mocks.bandCouncilsFindFirst.mockResolvedValue({
      id: 'bc-1',
      bandName: 'Treaty 7 Band Council',
    });
    const result = await svc.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(true);
    expect(result.bandName).toBe('Treaty 7 Band Council');
  });

  it('requestDataAccess throws when band council required but user not associated', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.mockSelect.mockReturnValue(chain([])); // no requesterData
    await expect(
      svc.requestDataAccess('req-1', 'health', 'research', 'sensitive'),
    ).rejects.toThrow('Band Council approval required');
  });

  it('getStorageConfig returns defaults when bandCouncil not found', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilsFindFirst.mockResolvedValue(null);
    const config = await svc.getStorageConfig('reserve-1');
    expect(config.hasOnPremiseServer).toBe(false);
    expect(config.storageLocation).toBe('canada_only');
  });

  it('getStorageConfig returns error defaults on DB failure', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilsFindFirst.mockRejectedValue(new Error('timeout'));
    const config = await svc.getStorageConfig('reserve-1');
    expect(config.hasOnPremiseServer).toBe(false);
  });

  it('generateComplianceReport counts active agreements', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilConsentFindMany.mockResolvedValue([{ id: 'c-1', consentGiven: true }]);
    mocks.bandCouncilsFindMany
      .mockResolvedValueOnce([{ id: 'bc-1', onReserveStorageEnabled: true }]) // with storage
      .mockResolvedValueOnce([{ id: 'bc-1' }, { id: 'bc-2' }]); // all
    mocks.accessLogFindMany.mockResolvedValue([]);
    const report = await svc.generateComplianceReport();
    expect(report.ocapPrinciples.ownership.compliant).toBe(true);
    expect(report.bandCouncilAgreements).toBe(1);
    expect(report.onPremiseStoragePercent).toBe(50);
  });

  /* ── Batch 33: branch gap-fill ── */

  it('verifyBandCouncilOwnership returns undefined bandName when bandCouncil has no name', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.indigenousMemberDataFindFirst.mockResolvedValue({
      bandCouncilId: 'bc-1',
      userId: 'member-1',
    });
    mocks.bandCouncilConsentFindFirst.mockResolvedValue({ id: 'consent-1', expiresAt: null });
    mocks.bandCouncilsFindFirst.mockResolvedValue({ id: 'bc-1', bandName: '' });
    const result = await svc.verifyBandCouncilOwnership('member-1');
    expect(result.hasAgreement).toBe(true);
    expect(result.bandName).toBeUndefined();
  });

  it('getStorageConfig includes endpoint when bandCouncil has storageLocation', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilsFindFirst.mockResolvedValue({
      id: 'bc-1',
      onReserveStorageEnabled: true,
      storageLocation: 'https://storage.band.ca',
      dataResidencyRequired: true,
    });
    const config = await svc.getStorageConfig('reserve-1');
    expect(config.hasOnPremiseServer).toBe(true);
    expect(config.endpoint).toBe('https://storage.band.ca');
    expect(config.storageLocation).toBe('canada_only');
  });

  it('getStorageConfig omits endpoint when storageLocation is empty', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilsFindFirst.mockResolvedValue({
      id: 'bc-1',
      onReserveStorageEnabled: false,
      storageLocation: '',
      dataResidencyRequired: false,
    });
    const config = await svc.getStorageConfig('reserve-1');
    expect(config.endpoint).toBeUndefined();
    expect(config.storageLocation).toBe('global');
  });

  it('generateComplianceReport returns 0% storage when no band councils', async () => {
    const svc = new IndigenousDataService('org-1', 'user-1');
    mocks.bandCouncilConsentFindMany.mockResolvedValue([]);
    mocks.bandCouncilsFindMany
      .mockResolvedValueOnce([]) // with storage
      .mockResolvedValueOnce([]); // all
    mocks.accessLogFindMany.mockResolvedValue([]);
    const report = await svc.generateComplianceReport();
    expect(report.onPremiseStoragePercent).toBe(0);
    expect(report.ocapPrinciples.ownership.compliant).toBe(false);
  });
});
