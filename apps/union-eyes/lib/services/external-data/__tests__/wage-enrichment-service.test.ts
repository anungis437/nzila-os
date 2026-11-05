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
  // The nested transaction (a savepoint) of the system transaction: it runs its work on the same statement stubs
  mockTransaction: vi.fn(),
  // How many system transactions are open right now: a provider call made while one is open would hold it for the length of a network call
  systemDepth: { value: 0 },
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

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    mocks.systemDepth.value++;
    try {
      return await fn({
        select: mocks.mockSelect,
        insert: mocks.mockInsert,
        update: mocks.mockUpdate,
        transaction: mocks.mockTransaction,
      });
    } finally {
      mocks.systemDepth.value--;
    }
  }),
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
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'sync-uuid-9999') }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WageEnrichmentService } from '../wage-enrichment-service';
import { withSystemContext } from '@/lib/db/with-rls-context';

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
    mocks.mockTransaction.mockImplementation(async (work: (savepoint: unknown) => Promise<unknown>) =>
      work({ select: mocks.mockSelect, insert: mocks.mockInsert, update: mocks.mockUpdate }));
    mocks.systemDepth.value = 0;

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

    it('round 52: executes under withSystemContext (SYSTEM_RUNTIME), not the plain tenant db — wage_benchmarks has no organizationId column and is only ever written by this SYSTEM_SCHEDULE cron path', async () => {
      mocks.mockGetWageData.mockResolvedValue([]);
      await service.syncWageData({ nocCodes: [] });
      expect(withSystemContext).toHaveBeenCalled();
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

    it('round 52: executes under withSystemContext (SYSTEM_RUNTIME), not the plain tenant db — cost_of_living_data has no organizationId column and is only ever written by this SYSTEM_SCHEDULE cron path', async () => {
      mocks.mockGetCOLAData.mockResolvedValue([]);
      await service.syncCOLAData({ geography: '01' });
      expect(withSystemContext).toHaveBeenCalled();
    });
  });

  describe('syncContributionRates', () => {
    const eiRates = { year: 2025, employeeRate: 1.63, employerRate: 2.28, maxInsurableEarnings: 65700 };
    const cppRates = { year: 2025, employeeRate: 5.95, employerRate: 5.95, exemptionLimit: 3500, maximumContribution: 3867 };

    beforeEach(() => {
      mocks.mockGetEIContributionRates.mockResolvedValue(eiRates);
      mocks.mockGetCPPContributionRates.mockResolvedValue(cppRates);
      mocks.mockLimit.mockResolvedValue([]); // no existing
    });

    it('syncs EI and CPP rates', async () => {
      const result = await service.syncContributionRates(2025);
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
      // An employee and an employer rate for each of the two sources
      expect(result.recordsInserted).toBe(4);
      expect(mocks.mockValues).toHaveBeenCalledWith(expect.objectContaining({ rateType: 'ei_employer', year: 2025 }));
      expect(mocks.mockValues).toHaveBeenCalledWith(expect.objectContaining({ rateType: 'cpp_employee', year: 2025 }));
    });

    it('round 57: contribution_rates is global reference data written as the system role — the sync log is opened, and the rates and the log\'s outcome are written, each in a system transaction', async () => {
      await service.syncContributionRates(2025);
      // One system transaction opens the sync log, a second writes the rates and records the outcome
      expect(withSystemContext).toHaveBeenCalledTimes(2);
    });

    it('calls the provider outside any system transaction, and writes only inside one', async () => {
      const openAtProviderCall: number[] = [];
      mocks.mockGetEIContributionRates.mockImplementation(async () => {
        openAtProviderCall.push(mocks.systemDepth.value);
        return eiRates;
      });
      mocks.mockGetCPPContributionRates.mockImplementation(async () => {
        openAtProviderCall.push(mocks.systemDepth.value);
        return cppRates;
      });
      const openAtWrite: number[] = [];
      mocks.mockInsert.mockImplementation(() => {
        openAtWrite.push(mocks.systemDepth.value);
        return { values: mocks.mockValues };
      });

      await service.syncContributionRates(2025);

      expect(openAtProviderCall).toEqual([0, 0]);
      // The sync log row and the four rate rows
      expect(openAtWrite).toHaveLength(5);
      expect(openAtWrite.every((open) => open === 1)).toBe(true);
    });

    it('writes each source in its own savepoint, so a failure on one does not undo the other', async () => {
      mocks.mockTransaction.mockImplementationOnce(async () => {
        throw new Error('write refused');
      });

      const result = await service.syncContributionRates(2025);

      expect(mocks.mockTransaction).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
      expect(result.recordsFailed).toBe(1);
      // The CPP rates (employee and employer) were still written
      expect(result.recordsInserted).toBe(2);
      expect(result.errors).toEqual([expect.stringContaining('Failed to sync EI rates')]);
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial', recordsFailed: 1, recordsInserted: 2 }));
    });

    it('does not write a source whose provider call failed, and reports it', async () => {
      mocks.mockGetEIContributionRates.mockRejectedValue(new Error('StatCan down'));

      const result = await service.syncContributionRates(2025);

      expect(mocks.mockTransaction).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.recordsProcessed).toBe(1);
      expect(result.recordsFailed).toBe(1);
      expect(result.recordsInserted).toBe(2);
      expect(result.errors).toEqual([expect.stringContaining('Failed to sync EI rates')]);
    });

    it('marks the sync failed, in its own system transaction, and rethrows when the rates cannot be written at all', async () => {
      vi.mocked(withSystemContext)
        .mockImplementationOnce(async (fn) => fn({ select: mocks.mockSelect, insert: mocks.mockInsert, update: mocks.mockUpdate } as never))
        .mockImplementationOnce(async () => {
          throw new Error('system database unavailable');
        });

      await expect(service.syncContributionRates(2025)).rejects.toThrow('system database unavailable');

      expect(withSystemContext).toHaveBeenCalledTimes(3);
      expect(mocks.mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', errorMessage: 'system database unavailable' }));
    });

    it('updates existing contribution rates', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'rate-1' }]); // existing found

      const result = await service.syncContributionRates(2025);
      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(2);
      expect(result.recordsInserted).toBe(0);
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
