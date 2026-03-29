import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  StatisticsCanadaClient,
  provinceToGeographyCode,
  getNOCCategory,
  calculateWageIncrease,
  WageDataSchema,
  UnionDensitySchema,
} from '../statcan-client';

describe('StatisticsCanadaClient', () => {
  let client: StatisticsCanadaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new StatisticsCanadaClient();
    global.fetch = vi.fn();
  });

  describe('getWageData', () => {
    it('fetches and parses valid wage data', async () => {
      const mockRecord = {
        GEO: '01', GEOUID: '01', GEOName: 'Canada',
        NAICS: '11', NAICSName: 'Agriculture',
        NOC: '0011', NOCName: 'Legislators',
        Wages: { UOM: 'Hourly', Vector: 'v1', Coordinate: 1, Value: 35.5, Decimals: 2 },
        Sex: 'B', AgeGroup: '15+', AgeGroupName: '15 years and over',
        Education: '1', EducationName: 'Total',
        Statistics: 'median', StatisticsName: 'Median',
        DataType: '1', DataTypeName: 'Type1',
        RefDate: '2025-01', Source: 'StatCan',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockRecord]),
      });

      const result = await client.getWageData({ nocCode: '0011' });
      expect(result).toHaveLength(1);
      expect(result[0].NOC).toBe('0011');
      expect(result[0].Wages.Value).toBe(35.5);
    });

    it('filters out invalid records', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ invalid: true }]),
      });

      const result = await client.getWageData({ nocCode: '0011' });
      expect(result).toHaveLength(0);
    });

    it('throws on API error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(client.getWageData({ nocCode: '0011' }))
        .rejects.toThrow('Statistics Canada API error');
    });

    it('passes geography and year params', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await client.getWageData({ nocCode: '0011', geography: '35', year: 2024, sex: 'F' });
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain('geo=35');
      expect(url).toContain('years=2024');
      expect(url).toContain('sex=F');
    });
  });

  describe('getMedianHourlyWage', () => {
    it('returns wage for hourly record', async () => {
      const mockRecord = {
        GEO: '01', GEOUID: '01', GEOName: 'Canada',
        NAICS: '11', NAICSName: 'Agri',
        NOC: '1234', NOCName: 'Test',
        Wages: { UOM: 'Hourly', Vector: 'v1', Coordinate: 1, Value: 28.5, Decimals: 2 },
        Sex: 'B', AgeGroup: '15+', AgeGroupName: '15+',
        Education: '1', EducationName: 'T',
        Statistics: 'med', StatisticsName: 'Median',
        DataType: '1', DataTypeName: 'T1',
        RefDate: '2025-01', Source: 'StatCan',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mockRecord]),
      });

      const result = await client.getMedianHourlyWage({ nocCode: '1234' });
      expect(result).not.toBeNull();
      expect(result!.wage).toBe(28.5);
      expect(result!.uom).toBe('Hourly');
    });

    it('returns null when no hourly data available', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await client.getMedianHourlyWage({ nocCode: '9999' });
      expect(result).toBeNull();
    });
  });

  describe('getUnionDensity', () => {
    it('fetches and parses union density data', async () => {
      const mock = {
        GEO: '01', GEOUID: '01', GEOName: 'Canada',
        Sex: 'B', UnionStatus: 'union_member', UnionStatusName: 'Union member',
        Value: 30.2, Vector: 'v1', Coordinate: 1, Decimals: 1,
        RefDate: '2025-01', Source: 'StatCan',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([mock]),
      });

      const result = await client.getUnionDensity({});
      expect(result).toHaveLength(1);
      expect(result[0].Value).toBe(30.2);
    });
  });

  describe('getCOLAData', () => {
    it('fetches COLA data', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ year: 2024, inflationRate: 2.5, cpi: 157.3 }]),
      });

      const result = await client.getCOLAData({ geography: '01' });
      expect(result).toHaveLength(1);
      expect(result[0].inflationRate).toBe(2.5);
      expect(result[0].region).toBe('01');
    });
  });

  describe('getEIContributionRates', () => {
    it('returns EI rates', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ year: 2025, employeeRate: 1.63, employerRate: 2.28, maxInsurableEarnings: 65700 }),
      });

      const result = await client.getEIContributionRates({ year: 2025 });
      expect(result.employeeRate).toBe(1.63);
    });
  });

  describe('getCPPContributionRates', () => {
    it('returns CPP rates', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ year: 2025, employeeRate: 5.95, employerRate: 5.95, exemptionLimit: 3500, maximumContribution: 3867 }),
      });

      const result = await client.getCPPContributionRates({ year: 2025 });
      expect(result.employeeRate).toBe(5.95);
      expect(result.exemptionLimit).toBe(3500);
    });
  });

  describe('getBatchWageData', () => {
    it('fetches data for multiple NOC codes in parallel', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await client.getBatchWageData({ nocCodes: ['0011', '1234'] });
      expect(result.size).toBe(2);
      expect(result.has('0011')).toBe(true);
      expect(result.has('1234')).toBe(true);
    });
  });
});

describe('provinceToGeographyCode', () => {
  it('maps known provinces', () => {
    expect(provinceToGeographyCode('ON')).toBe('35');
    expect(provinceToGeographyCode('BC')).toBe('59');
    expect(provinceToGeographyCode('AB')).toBe('48');
  });

  it('is case-insensitive', () => {
    expect(provinceToGeographyCode('ontario')).toBe('35');
  });

  it('returns 01 (Canada) for unknown', () => {
    expect(provinceToGeographyCode('XX')).toBe('01');
  });
});

describe('getNOCCategory', () => {
  it('returns category for known prefix', () => {
    expect(getNOCCategory('0011')).toBe('Management occupations');
    expect(getNOCCategory('3012')).toBe('Health occupations');
  });

  it('returns Unknown for unrecognized prefix', () => {
    expect(getNOCCategory('')).toBe('Unknown');
  });
});

describe('calculateWageIncrease', () => {
  it('calculates percentage increase', () => {
    expect(calculateWageIncrease(20, 22)).toBeCloseTo(10, 1);
  });

  it('returns 0 for zero old wage', () => {
    expect(calculateWageIncrease(0, 10)).toBe(0);
  });

  it('handles negative changes', () => {
    expect(calculateWageIncrease(30, 27)).toBeCloseTo(-10, 1);
  });
});

describe('StatisticsCanadaClient (gap coverage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('sets Authorization header when STATCAN_API_KEY is configured', async () => {
    process.env.STATCAN_API_KEY = 'test-api-key-123';
    const client = new StatisticsCanadaClient();
    delete process.env.STATCAN_API_KEY;

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await client.getWageData({ nocCode: '0011' });
    const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer test-api-key-123');
  });

  it('fetch logs non-Error thrown value', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue('network down');

    await expect(client.getWageData({ nocCode: '0011' }))
      .rejects.toBe('network down');
  });

  it('getEIContributionRates defaults to current year', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ year: 2026, employeeRate: 1.63, employerRate: 2.28, maxInsurableEarnings: 65700 }),
    });

    const result = await client.getEIContributionRates();
    expect(result.year).toBe(2026);
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(`year=${new Date().getFullYear()}`);
  });

  it('getCPPContributionRates defaults to current year', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ year: 2026, employeeRate: 5.95, employerRate: 5.95, exemptionLimit: 3500, maximumContribution: 3867 }),
    });

    const result = await client.getCPPContributionRates();
    expect(result.year).toBe(2026);
  });

  it('getUnionDensity passes naicsCode, nocCode, and year params', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await client.getUnionDensity({ naicsCode: '31-33', nocCode: '0011', year: 2024, geography: '35' });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('naics=31-33');
    expect(url).toContain('noc=0011');
    expect(url).toContain('years=2024');
    expect(url).toContain('geo=35');
  });

  it('getCOLAData maps raw data items correctly', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { year: 2020, inflationRate: 0.7, cpi: 136.5 },
        { year: 2021, inflationRate: 3.4, cpi: 141.6 },
      ]),
    });

    const result = await client.getCOLAData({ geography: '35', startYear: 2020, endYear: 2021 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ year: 2020, inflationRate: 0.7, cpi: 136.5, region: '35' });
    expect(result[1]).toEqual({ year: 2021, inflationRate: 3.4, cpi: 141.6, region: '35' });
  });

  it('getBatchWageData passes geography and year to each call', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await client.getBatchWageData({ nocCodes: ['0011'], geography: '35', year: 2024 });
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('geo=35');
    expect(url).toContain('years=2024');
  });

  it('getUnionDensity filters invalid records and hits parse-error logging path', async () => {
    const client = new StatisticsCanadaClient();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ invalid: true }]),
    });

    const result = await client.getUnionDensity({ geography: '35' });
    expect(result).toHaveLength(0);
  });

  it('getWageData handles non-Error parse throws with fallback message', async () => {
    const client = new StatisticsCanadaClient();
    const parseSpy = vi.spyOn(WageDataSchema, 'parse').mockImplementation(() => {
      throw 'schema parse exploded';
    });

    try {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          GEO: '01', GEOUID: '01', GEOName: 'Canada',
          NAICS: '11', NAICSName: 'Agri',
          NOC: '1234', NOCName: 'Test',
          Wages: { UOM: 'Hourly', Vector: 'v1', Coordinate: 1, Value: 28.5, Decimals: 2 },
          Sex: 'B', AgeGroup: '15+', AgeGroupName: '15+',
          Education: '1', EducationName: 'T',
          Statistics: 'med', StatisticsName: 'Median',
          DataType: '1', DataTypeName: 'T1',
          RefDate: '2025-01', Source: 'StatCan',
        }]),
      });

      const result = await client.getWageData({ nocCode: '1234' });
      expect(result).toHaveLength(0);
    } finally {
      parseSpy.mockRestore();
    }
  });
});

describe('Zod schemas', () => {
  it('WageDataSchema rejects incomplete data', () => {
    const result = WageDataSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('UnionDensitySchema rejects incomplete data', () => {
    const result = UnionDensitySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
