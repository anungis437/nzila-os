import { describe, it, expect, vi, beforeEach } from 'vitest';

// === Hoisted mocks ===
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockGetWageData: vi.fn(),
  mockGetMedianHourlyWage: vi.fn(),
  mockGetUnionDensity: vi.fn(),
  mockGetCOLAData: vi.fn(),
  mockGetEIContributionRates: vi.fn(),
  mockGetCPPContributionRates: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema', () => ({
  wageBenchmarks: { id: 'id', nocCode: 'nocCode', geographyCode: 'geographyCode', refDate: 'refDate', sex: 'sex' },
  unionDensity: { id: 'id', geographyCode: 'geographyCode', unionStatus: 'unionStatus', refDate: 'refDate' },
  costOfLivingData: { id: 'id', geographyCode: 'geographyCode', year: 'year' },
  contributionRates: { id: 'id', rateType: 'rateType', year: 'year' },
  externalDataSyncLog: { syncId: 'syncId' },
}));

vi.mock('../statcan-client', () => ({
  statCanClient: {
    getWageData: mocks.mockGetWageData,
    getMedianHourlyWage: mocks.mockGetMedianHourlyWage,
    getUnionDensity: mocks.mockGetUnionDensity,
    getCOLAData: mocks.mockGetCOLAData,
    getEIContributionRates: mocks.mockGetEIContributionRates,
    getCPPContributionRates: mocks.mockGetCPPContributionRates,
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'sync-uuid-9999') }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WageEnrichmentService } from '../wage-enrichment-service';

describe('WageEnrichmentService', () => {
  let service: WageEnrichmentService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use mockImplementation for chain mocks — shares mockLimit so tests can customize
    mocks.mockFrom.mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: mocks.mockLimit,
        orderBy: vi.fn().mockImplementation(() => ({ limit: mocks.mockLimit })),
      })),
      orderBy: vi.fn().mockImplementation(() => ({ limit: mocks.mockLimit })),
    }));
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockValues.mockResolvedValue(undefined);
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
    mocks.mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    service = new WageEnrichmentService();
  });

  describe('syncWageData', () => {
    it('creates sync log and processes wage records', async () => {
      const mockRecord = {
        NOC: '0011', NOCName: 'Legislators', GEO: '01', GEOName: 'Canada',
        NAICS: '11', NAICSName: 'Agriculture',
        Wages: { UOM: 'Hourly', Vector: 'v1', Coordinate: 1, Value: 35, Symbol: '', Decimals: 2 },
        Sex: 'B', AgeGroup: '15+', AgeGroupName: '15+',
        Education: '1', EducationName: 'T',
        Statistics: 'median', StatisticsName: 'Median',
        DataType: '1', DataTypeName: 'T1',
        RefDate: '2025-01', Source: 'StatCan',
      };

      mocks.mockGetWageData.mockResolvedValue([mockRecord]);
      mocks.mockLimit.mockResolvedValue([]); // no existing

      const result = await service.syncWageData({ nocCodes: ['0011'] });
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsInserted).toBe(1);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('updates existing records', async () => {
      mocks.mockGetWageData.mockResolvedValue([{
        NOC: '0011', NOCName: 'X', GEO: '01', GEOName: 'CA',
        NAICS: '', NAICSName: '',
        Wages: { UOM: 'Hourly', Vector: 'v', Coordinate: 1, Value: 40, Decimals: 2 },
        Sex: 'B', AgeGroup: '', AgeGroupName: '',
        Education: '', EducationName: '',
        Statistics: 'median', StatisticsName: '',
        DataType: '', DataTypeName: '',
        RefDate: '2025-01', Source: 'StatCan',
      }]);
      mocks.mockLimit.mockResolvedValue([{ id: 'existing-1' }]); // existing found

      const result = await service.syncWageData({ nocCodes: ['0011'] });
      expect(result.recordsUpdated).toBe(1);
    });

    it('handles fetch errors gracefully', async () => {
      mocks.mockGetWageData.mockRejectedValue(new Error('API down'));

      const result = await service.syncWageData({ nocCodes: ['9999'] });
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns syncId', async () => {
      mocks.mockGetWageData.mockResolvedValue([]);
      const result = await service.syncWageData({ nocCodes: [] });
      expect(result.syncId).toContain('sync_');
    });
  });

  describe('syncUnionDensity', () => {
    it('inserts new union density records', async () => {
      mocks.mockGetUnionDensity.mockResolvedValue([{
        GEO: '01', GEOName: 'Canada',
        Sex: 'B', UnionStatus: 'union_member', UnionStatusName: 'Member',
        Value: 30, RefDate: '2025-01', Vector: 'v', Coordinate: 1, Decimals: 1,
        Source: 'StatCan',
      }]);
      mocks.mockLimit.mockResolvedValue([]); // no existing

      const result = await service.syncUnionDensity({});
      expect(result.success).toBe(true);
      expect(result.recordsInserted).toBe(1);
    });

    it('updates existing density records', async () => {
      mocks.mockGetUnionDensity.mockResolvedValue([{
        GEO: '01', GEOName: 'Canada',
        Sex: 'B', UnionStatus: 'union_member', UnionStatusName: 'Member',
        Value: 31, RefDate: '2025-01', Vector: 'v', Coordinate: 1, Decimals: 1,
        Source: 'StatCan',
      }]);
      mocks.mockLimit.mockResolvedValue([{ id: 'ud-1' }]);

      const result = await service.syncUnionDensity({});
      expect(result.recordsUpdated).toBe(1);
    });
  });

  describe('syncCOLAData', () => {
    it('syncs CPI/inflation data', async () => {
      mocks.mockGetCOLAData.mockResolvedValue([
        { year: 2024, inflationRate: 2.5, cpi: 157, region: '01' },
      ]);
      mocks.mockLimit.mockResolvedValue([]);

      const result = await service.syncCOLAData({ geography: '01' });
      expect(result.success).toBe(true);
      expect(result.recordsInserted).toBe(1);
    });
  });

  describe('syncContributionRates', () => {
    it('syncs EI and CPP rates', async () => {
      mocks.mockGetEIContributionRates.mockResolvedValue({
        year: 2025, employeeRate: 1.63, employerRate: 2.28, maxInsurableEarnings: 65700,
      });
      mocks.mockGetCPPContributionRates.mockResolvedValue({
        year: 2025, employeeRate: 5.95, employerRate: 5.95, exemptionLimit: 3500, maximumContribution: 3867,
      });
      mocks.mockLimit.mockResolvedValue([]); // no existing

      const result = await service.syncContributionRates(2025);
      expect(result.success).toBe(true);
      expect(result.recordsInserted).toBeGreaterThanOrEqual(2);
    });

    it('updates existing contribution rates', async () => {
      mocks.mockGetEIContributionRates.mockResolvedValue({
        year: 2025, employeeRate: 1.63, employerRate: 2.28, maxInsurableEarnings: 65700,
      });
      mocks.mockGetCPPContributionRates.mockResolvedValue({
        year: 2025, employeeRate: 5.95, employerRate: 5.95, exemptionLimit: 3500, maximumContribution: 3867,
      });
      mocks.mockLimit.mockResolvedValue([{ id: 'rate-1' }]); // existing found

      const result = await service.syncContributionRates(2025);
      expect(result.recordsUpdated).toBeGreaterThan(0);
    });
  });

  describe('getBenchmarksForCBA', () => {
    it('returns benchmarks, union density, and inflation', async () => {
      mocks.mockGetMedianHourlyWage.mockResolvedValue({ wage: 32, uom: 'Hourly', year: 2025, geography: '01' });
      mocks.mockGetUnionDensity.mockResolvedValue([
        { UnionStatus: 'union_member', Sex: 'B', Value: 30, NAICSName: 'Public Admin' },
      ]);
      mocks.mockGetCOLAData.mockResolvedValue([
        { year: 2025, inflationRate: 2.8, cpi: 160, region: '01' },
      ]);

      const result = await service.getBenchmarksForCBA({
        nocCodes: ['0011'],
        geography: '01',
      });

      expect(result.benchmarks).toHaveLength(1);
      expect(result.benchmarks[0].medianWage).toBe(32);
    });

    it('handles missing wage data', async () => {
      mocks.mockGetMedianHourlyWage.mockResolvedValue(null);
      mocks.mockGetUnionDensity.mockResolvedValue([]);
      mocks.mockGetCOLAData.mockResolvedValue([]);

      const result = await service.getBenchmarksForCBA({
        nocCodes: ['9999'],
        geography: '01',
      });

      expect(result.benchmarks[0].medianWage).toBeNull();
    });
  });
});
