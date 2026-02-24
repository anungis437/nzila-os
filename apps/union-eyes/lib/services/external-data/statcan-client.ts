/**
 * Statistics Canada API Client
 * 
 * Fetches labor market data for CBA enrichment:
 * - Wage data by NOC code and geography
 * - Union density statistics
 * - Employment and demographic data
 * 
 * API Documentation: https://www.statcan.gc.ca/eng/api
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Statistics Canada wage data response schema
 */
export const WageDataSchema = z.object({
  GEO: z.string(),           // Geography code (01 = Canada, 35 = Ontario, 59 = BC)
  GEOUID: z.string(),        // Geographic UID
  GEOName: z.string(),       // Geographic name
  NAICS: z.string(),         // Industry code (NAICS)
  NAICSName: z.string(),    // Industry name
  NOC: z.string(),           // National Occupation Classification code
  NOCName: z.string(),       // Occupation name
  Wages: z.object({
    UOM: z.string(),         // Unit of measure (Hourly, Annual)
    Vector: z.string(),       // Data vector identifier
    Coordinate: z.number(), // Chart coordinate
    Value: z.number(),       // Value
    Symbol: z.string().optional(), // Data quality symbol
    Terminated: z.string().optional(),
    Decimals: z.number(),
  }),
  Sex: z.string(),           // Gender (M, F, B = Both)
  AgeGroup: z.string(),      // Age group code
  AgeGroupName: z.string(),  // Age group description
  Education: z.string(),    // Education level
  EducationName: z.string(),
  Statistics: z.string(),    // Statistic type
  StatisticsName: z.string(),
  DataType: z.string(),      // Type of data
  DataTypeName: z.string(),
  RefDate: z.string(),       // Reference date (YYYY-MM)
  Source: z.string(),        // Data source
});

export type WageData = z.infer<typeof WageDataSchema>;

/**
 * Union density response schema
 */
export const UnionDensitySchema = z.object({
  GEO: z.string(),
  GEOUID: z.string(),
  GEOName: z.string(),
  NAICS: z.string().optional(),
  NAICSName: z.string().optional(),
  NOC: z.string().optional(),
  NOCName: z.string().optional(),
  Sex: z.string(),
  AgeGroup: z.string().optional(),
  AgeGroupName: z.string().optional(),
  Citizenship: z.string().optional(),
  CitizenshipName: z.string().optional(),
  UnionStatus: z.string(),  // Union covered, Union member
  UnionStatusName: z.string(),
  Value: z.number(),
  Vector: z.string(),
  Coordinate: z.number(),
  Symbol: z.string().optional(),
  Terminated: z.string().optional(),
  Decimals: z.number(),
  RefDate: z.string(),
  Source: z.string(),
});

export type UnionDensity = z.infer<typeof UnionDensitySchema>;

/**
 * Cost of living data schema
 */
export const COLADataSchema = z.object({
  GEO: z.string(),
  GEOName: z.string(),
  ConsumerPriceIndex: z.object({
    Vector: z.string(),
    Coordinate: z.number(),
    Value: z.number(),
    RefDate: z.string(),
  }),
  InflationRate: z.object({
    Year: z.number(),
    Rate: z.number(),
  }),
});

export type COLAData = z.infer<typeof COLADataSchema>;

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class StatisticsCanadaClient {
  private baseUrl: string;
  private apiKey: string;
  private baseHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = process.env.STATCAN_API_URL || 'https://api.statcan.gc.ca';
    this.apiKey = process.env.STATCAN_API_KEY || '';
    
    this.baseHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      this.baseHeaders['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  /**
   * Make authenticated request to Statistics Canada API
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    logger.info('[StatCan] Fetching data', { endpoint });
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.baseHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[StatCan] API error', {
          status: response.status,
          endpoint,
          error: errorText,
        });
        throw new Error(`Statistics Canada API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      logger.error('[StatCan] Request failed', {
        endpoint,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Fetch wage data by NOC code and geography
   */
  async getWageData(params: {
    nocCode: string;
    geography?: string;
    year?: number;
    sex?: 'M' | 'F' | 'B';
  }): Promise<WageData[]> {
    const {
      nocCode,
      geography = '01',
      year,
      sex = 'B',
    } = params;

    const paramsObj: Record<string, string | number> = {
      codes: nocCode,
      geo: geography,
      sex,
    };

    if (year) {
      paramsObj.years = year;
    }

    const queryString = new URLSearchParams();
    Object.entries(paramsObj).forEach(([key, value]) => {
      queryString.append(key, String(value));
    });

    const endpoint = `/ind-eoc/wages/v1?${queryString.toString()}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData = await this.fetch<any[]>(endpoint);
    
    const results = rawData.map(record => {
      try {
        return WageDataSchema.parse(record);
      } catch (error) {
        logger.warn('[StatCan] Invalid wage record', {
          nocCode,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    }).filter((r): r is WageData => r !== null);

    logger.info('[StatCan] Wage data retrieved', {
      nocCode,
      geography,
      recordCount: results.length,
    });

    return results;
  }

  /**
   * Get median hourly wage for a NOC code
   */
  async getMedianHourlyWage(params: {
    nocCode: string;
    geography?: string;
    year?: number;
  }): Promise<{
    wage: number;
    uom: string;
    year: number;
    geography: string;
  } | null> {
    const data = await this.getWageData(params);
    
    const hourlyRecord = data.find(
      d => d.Wages.UOM === 'Hourly' && d.Wages.Value > 0
    );

    if (!hourlyRecord) {
      logger.warn('[StatCan] No hourly wage data found', params);
      return null;
    }

    return {
      wage: hourlyRecord.Wages.Value,
      uom: 'Hourly',
      year: parseInt(hourlyRecord.RefDate.split('-')[0]),
      geography: params.geography || '01',
    };
  }

  /**
   * Get union density by industry and geography
   */
  async getUnionDensity(params: {
    naicsCode?: string;
    geography?: string;
    nocCode?: string;
    year?: number;
  }): Promise<UnionDensity[]> {
    const {
      naicsCode,
      geography = '01',
      nocCode,
      year,
    } = params;

    const paramsObj: Record<string, string | number> = {
      geo: geography,
    };

    if (naicsCode) paramsObj.naics = naicsCode;
    if (nocCode) paramsObj.noc = nocCode;
    if (year) paramsObj.years = year;

    const queryString = new URLSearchParams();
    Object.entries(paramsObj).forEach(([key, value]) => {
      queryString.append(key, String(value));
    });

    const endpoint = `/labour-union-density/v1?${queryString.toString()}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData = await this.fetch<any[]>(endpoint);
    
    const results = rawData.map(record => {
      try {
        return UnionDensitySchema.parse(record);
      } catch (error) {
        logger.warn('[StatCan] Invalid union density record', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    }).filter((r): r is UnionDensity => r !== null);

    logger.info('[StatCan] Union density data retrieved', {
      naicsCode,
      geography,
      recordCount: results.length,
    });

    return results;
  }

  /**
   * Get cost of living adjustments by region
   */
  async getCOLAData(params: {
    geography: string;
    startYear?: number;
    endYear?: number;
  }): Promise<{
    year: number;
    inflationRate: number;
    cpi: number;
    region: string;
  }[]> {
    const { geography, startYear = 2018, endYear = new Date().getFullYear() } = params;

    const queryParams = new URLSearchParams({
      geo: geography,
      startYear: String(startYear),
      endYear: String(endYear),
    });

    const endpoint = `/ind-econ/cola/v1?${queryParams.toString()}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData = await this.fetch<any[]>(endpoint);
    
    return rawData.map(item => ({
      year: item.year,
      inflationRate: item.inflationRate,
      cpi: item.cpi,
      region: geography,
    }));
  }

  /**
   * Get employment insurance contribution rates
   */
  async getEIContributionRates(params: {
    year?: number;
  } = {}): Promise<{
    year: number;
    employeeRate: number;
    employerRate: number;
    maxInsurableEarnings: number;
  }> {
    const year = params.year || new Date().getFullYear();

    const endpoint = `/ins-ei/contributions/v1?year=${year}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(endpoint);
    
    return {
      year: data.year,
      employeeRate: data.employeeRate,
      employerRate: data.employerRate,
      maxInsurableEarnings: data.maxInsurableEarnings,
    };
  }

  /**
   * Get CPP contribution rates
   */
  async getCPPContributionRates(params: {
    year?: number;
  } = {}): Promise<{
    year: number;
    employeeRate: number;
    employerRate: number;
    exemptionLimit: number;
    maximumContribution: number;
  }> {
    const year = params.year || new Date().getFullYear();

    const endpoint = `/ins-cpp/contributions/v1?year=${year}`;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetch<any>(endpoint);
    
    return {
      year: data.year,
      employeeRate: data.employeeRate,
      employerRate: data.employerRate,
      exemptionLimit: data.exemptionLimit,
      maximumContribution: data.maximumContribution,
    };
  }

  /**
   * Batch fetch wage data for multiple NOC codes
   */
  async getBatchWageData(params: {
    nocCodes: string[];
    geography?: string;
    year?: number;
  }): Promise<Map<string, WageData[]>> {
    const results = new Map<string, WageData[]>();
    
    await Promise.all(
      params.nocCodes.map(async (nocCode) => {
        const data = await this.getWageData({
          nocCode,
          geography: params.geography,
          year: params.year,
        });
        results.set(nocCode, data);
      })
    );

    return results;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function provinceToGeographyCode(province: string): string {
  const mapping: Record<string, string> = {
    'CA': '01',
    'FEDERAL': '01',
    'CANADA': '01',
    'ON': '35',
    'ONTARIO': '35',
    'BC': '59',
    'BRITISH_COLUMBIA': '59',
    'AB': '48',
    'ALBERTA': '48',
    'QC': '24',
    'QUEBEC': '24',
    'MB': '46',
    'MANITOBA': '46',
    'SK': '47',
    'SASKATCHEWAN': '47',
    'NS': '12',
    'NOVA_SCOTIA': '12',
    'NB': '13',
    'NEW_BRUNSWICK': '13',
    'NL': '10',
    'NEWFOUNDLAND': '10',
    'PE': '11',
    'PRINCE_EDWARD_ISLAND': '11',
  };

  return mapping[province.toUpperCase()] || '01';
}

export function getNOCCategory(nocCode: string): string {
  const prefix = nocCode.charAt(0);
  
  const categories: Record<string, string> = {
    '0': 'Management occupations',
    '1': 'Business, finance and administration occupations',
    '2': 'Natural and applied sciences and related occupations',
    '3': 'Health occupations',
    '4': 'Occupations in education, law and social, community and government services',
    '5': 'Occupations in art, culture, recreation and sport',
    '6': 'Sales and service occupations',
    '7': 'Trades, transport and equipment operators and related occupations',
    '8': 'Natural resources, agriculture and related production occupations',
    '9': 'Occupations in manufacturing and utilities',
  };

  return categories[prefix] || 'Unknown';
}

export function calculateWageIncrease(
  oldWage: number,
  newWage: number
): number {
  if (oldWage <= 0) return 0;
  return ((newWage - oldWage) / oldWage) * 100;
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const statCanClient = new StatisticsCanadaClient();

