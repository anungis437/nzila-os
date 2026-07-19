import { beforeEach, describe, expect, it, vi } from 'vitest';

const okResult = {
  success: true,
  recordsProcessed: 10,
  recordsInserted: 4,
  recordsUpdated: 5,
  recordsFailed: 1,
};

const m = vi.hoisted(() => ({
  syncWageData: vi.fn(),
  syncUnionDensity: vi.fn(),
  syncCOLAData: vi.fn(),
  syncContributionRates: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: vi.fn((_: unknown, handler: () => Promise<unknown>) => handler),
}));

vi.mock('@/lib/services/external-data/wage-enrichment-service', () => ({
  wageEnrichmentService: {
    syncWageData: m.syncWageData,
    syncUnionDensity: m.syncUnionDensity,
    syncCOLAData: m.syncCOLAData,
    syncContributionRates: m.syncContributionRates,
  },
}));

vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../cron/external-data-sync/route');
}

describe('cron/external-data-sync route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.syncWageData.mockResolvedValue({ ...okResult, recordsFailed: 0 });
    m.syncUnionDensity.mockResolvedValue({ ...okResult, recordsFailed: 0 });
    m.syncCOLAData.mockResolvedValue({ ...okResult, recordsFailed: 0 });
    m.syncContributionRates.mockResolvedValue({ ...okResult, recordsFailed: 0 });
  });

  it('runs all sync stages successfully through GET', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toMatchObject({
      syncType: 'scheduled',
      summary: expect.objectContaining({ success: true, totalProcessed: 40, totalInserted: 16, totalUpdated: 20 }),
      errors: [],
    });
    expect(m.syncWageData).toHaveBeenCalled();
    expect(m.syncUnionDensity).toHaveBeenCalled();
    expect(m.syncCOLAData).toHaveBeenCalled();
    expect(m.syncContributionRates).toHaveBeenCalled();
  });

  it('records stage-level errors and still returns a summary envelope', async () => {
    const { POST } = await loadRoute();
    m.syncWageData.mockRejectedValueOnce(new Error('wage offline'));
    m.syncUnionDensity.mockResolvedValueOnce({ ...okResult, success: false, recordsFailed: 2 });

    const result = await POST();

    expect(result).toMatchObject({
      syncType: 'scheduled',
      summary: expect.objectContaining({ success: false }),
    });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Wages sync failed'),
      expect.stringContaining('Union density sync had 2 failures'),
    ]));
    expect(result.dataSources.wages).toMatchObject({ success: false });
  });

  it('returns outer failure envelope when orchestration throws', async () => {
    const { GET } = await loadRoute();
    m.syncWageData.mockImplementationOnce(() => {
      throw new Error('fatal startup failure');
    });

    const result = await GET();

    expect(result.summary.success).toBe(false);
    expect(result.errors[0]).toContain('fatal startup failure');
  });
});