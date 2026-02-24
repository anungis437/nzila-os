/**
 * Wage Enrichment Service
 * 
 * Handles synchronization of external wage data (Statistics Canada, LRB, CLC)
 * into the application database for CBA benchmarking and enrichment.
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { 
  wageBenchmarks, 
  unionDensity as unionDensityTable, 
  costOfLivingData,
  contributionRates,
  externalDataSyncLog 
} from '@/db/schema';
import { statCanClient } from './statcan-client';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { UnionDensity as _UnionDensityType } from './statcan-client';

// =============================================================================
// TYPES
// =============================================================================

export interface SyncResult {
  success: boolean;
  syncId: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
  duration: number;
}

export interface WageBenchmarkParams {
  nocCodes: string[];
  geography?: string;
  year?: number;
  includeUnionDensity?: boolean;
  includeCOLA?: boolean;
}

export interface EnrichmentResult {
  benchmarks: {
    nocCode: string;
    medianWage: number | null;
    geography: string;
    year: number;
  }[];
  unionDensity: {
    overall: number;
    byIndustry: Record<string, number>;
  };
  inflationRate: number;
}

// =============================================================================
// ENRICHMENT SERVICE CLASS
// =============================================================================

export class WageEnrichmentService {
  private statCanClient: typeof statCanClient;
  private syncId: string;

  constructor() {
    this.statCanClient = statCanClient;
    this.syncId = '';
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  private async createSyncLog(
    source: string,
    sourceType: string,
    status: 'running' | 'completed' | 'failed' = 'running',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parameters?: Record<string, any>
  ): Promise<string> {
    const syncId = this.generateSyncId();
    
    await db.insert(externalDataSyncLog).values({
      syncId,
      source,
      sourceType,
      status,
      syncType: 'scheduled',
      parameters: parameters ? JSON.stringify(parameters) : undefined,
    });

    return syncId;
  }

  private async updateSyncLog(
    syncId: string,
    result: {
      status: 'completed' | 'failed';
      recordsProcessed: number;
      recordsInserted: number;
      recordsUpdated: number;
      recordsFailed: number;
      errorMessage?: string;
      errorDetails?: string;
    }
  ): Promise<void> {
    await db.update(externalDataSyncLog)
      .set({
        status: result.status,
        recordsProcessed: result.recordsProcessed,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        errorMessage: result.errorMessage,
        errorDetails: result.errorDetails,
        completedAt: new Date(),
      })
      .where(eq(externalDataSyncLog.syncId, syncId));
  }

  /**
   * Sync wage data from Statistics Canada
   */
  async syncWageData(params: {
    nocCodes: string[];
    geography?: string;
    year?: number;
  }): Promise<SyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('statcan', 'api', 'running', params);
    this.syncId = syncId;

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[Enrichment] Starting wage data sync', { syncId, params });

      for (const nocCode of params.nocCodes) {
        try {
          const wageData = await this.statCanClient.getWageData({
            nocCode,
            geography: params.geography,
            year: params.year,
          });

          for (const record of wageData) {
            recordsProcessed++;

            try {
              const existing = await db.select()
                .from(wageBenchmarks)
                .where(
                  and(
                    eq(wageBenchmarks.nocCode, record.NOC),
                    eq(wageBenchmarks.geographyCode, record.GEO),
                    eq(wageBenchmarks.refDate, record.RefDate),
                    eq(wageBenchmarks.sex, record.Sex),
                  )
                )
                .limit(1);

              const wageValue = String(record.Wages.Value);

              if (existing.length > 0) {
                await db.update(wageBenchmarks)
                  .set({
                    wageValue,
                    wageType: this.mapStatisticsToWageType(record.Statistics),
                    updatedAt: new Date(),
                    syncId,
                  })
                  .where(eq(wageBenchmarks.id, existing[0].id));
                recordsUpdated++;
              } else {
                await db.insert(wageBenchmarks).values({
                  nocCode: record.NOC,
                  nocName: record.NOCName,
                  nocCategory: null,
                  geographyCode: record.GEO,
                  geographyName: record.GEOName,
                  geographyType: record.GEO.length === 2 ? 'national' : 'provincial',
                  naicsCode: record.NAICS || null,
                  naicsName: record.NAICSName || null,
                  wageValue,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  wageUnit: record.Wages.UOM.toLowerCase() as any,
                  wageType: this.mapStatisticsToWageType(record.Statistics),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  sex: record.Sex as any,
                  ageGroup: record.AgeGroup || null,
                  ageGroupName: record.AgeGroupName || null,
                  educationLevel: record.Education || null,
                  statisticsType: record.Statistics,
                  dataType: record.DataType,
                  refDate: record.RefDate,
                  surveyYear: parseInt(record.RefDate.split('-')[0]),
                  source: 'Statistics Canada',
                  dataQualitySymbol: record.Wages.Symbol || null,
                  decimals: record.Wages.Decimals,
                  syncId,
                });
                recordsInserted++;
              }
            } catch (error) {
              recordsFailed++;
              errors.push(`Failed to process record for NOC ${record.NOC}: ${error}`);
            }
          }

          logger.info('[Enrichment] Processed NOC code', { nocCode, count: wageData.length });
        } catch (error) {
          recordsFailed += params.nocCodes.length;
          errors.push(`Failed to fetch data for NOC ${nocCode}: ${error}`);
        }
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
      });

      return {
        success: recordsFailed === 0,
        syncId,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sync union density data
   */
  async syncUnionDensity(params: {
    naicsCode?: string;
    geography?: string;
    year?: number;
  }): Promise<SyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('statcan', 'api', 'running', { ...params, type: 'union_density' });

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      const data = await this.statCanClient.getUnionDensity(params);

      for (const record of data) {
        recordsProcessed++;

        try {
          const existing = await db.select()
            .from(unionDensityTable)
            .where(
              and(
                eq(unionDensityTable.geographyCode, record.GEO),
                eq(unionDensityTable.unionStatus, record.UnionStatus),
                eq(unionDensityTable.refDate, record.RefDate),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(unionDensityTable)
              .set({
                densityValue: String(record.Value),
                updatedAt: new Date(),
                syncId,
              })
              .where(eq(unionDensityTable.id, existing[0].id));
            recordsUpdated++;
          } else {
            await db.insert(unionDensityTable).values({
              geographyCode: record.GEO,
              geographyName: record.GEOName,
              naicsCode: record.NAICS || null,
              naicsName: record.NAICSName || null,
              nocCode: record.NOC || null,
              nocName: record.NOCName || null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sex: record.Sex as any,
              ageGroup: record.AgeGroup || null,
              ageGroupName: record.AgeGroupName || null,
              citizenship: record.Citizenship || null,
              citizenshipName: record.CitizenshipName || null,
              unionStatus: record.UnionStatus,
              unionStatusName: record.UnionStatusName,
              densityValue: String(record.Value),
              refDate: record.RefDate,
              surveyYear: parseInt(record.RefDate.split('-')[0]),
              source: 'Statistics Canada',
              syncId,
            });
            recordsInserted++;
          }
        } catch (error) {
          recordsFailed++;
          errors.push(`Failed to process union density record: ${error}`);
        }
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
      });

      return {
        success: recordsFailed === 0,
        syncId,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sync CPI and inflation data
   */
  async syncCOLAData(params: {
    geography: string;
    startYear?: number;
    endYear?: number;
  }): Promise<SyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('statcan', 'api', 'running', { ...params, type: 'cola' });

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      const data = await this.statCanClient.getCOLAData(params);

      for (const record of data) {
        recordsProcessed++;

        try {
          const existing = await db.select()
            .from(costOfLivingData)
            .where(
              and(
                eq(costOfLivingData.geographyCode, record.region),
                eq(costOfLivingData.year, record.year),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(costOfLivingData)
              .set({
                cpiValue: String(record.cpi),
                inflationRate: String(record.inflationRate),
                updatedAt: new Date(),
                syncId,
              })
              .where(eq(costOfLivingData.id, existing[0].id));
            recordsUpdated++;
          } else {
            await db.insert(costOfLivingData).values({
              geographyCode: record.region,
              geographyName: this.getGeographyName(record.region),
              cpiValue: String(record.cpi),
              inflationRate: String(record.inflationRate),
              year: record.year,
              refDate: `${record.year}-01`,
              source: 'Statistics Canada',
              syncId,
            });
            recordsInserted++;
          }
        } catch (error) {
          recordsFailed++;
          errors.push(`Failed to process COLA record: ${error}`);
        }
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
      });

      return {
        success: recordsFailed === 0,
        syncId,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sync contribution rates (EI, CPP)
   */
  async syncContributionRates(year?: number): Promise<SyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('statcan', 'api', 'running', { type: 'contributions', year });

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];
    const currentYear = year || new Date().getFullYear();

    try {
      try {
        const eiRates = await this.statCanClient.getEIContributionRates({ year: currentYear });
        recordsProcessed++;

        const existing = await db.select()
          .from(contributionRates)
          .where(
            and(
              eq(contributionRates.rateType, 'ei_employee'),
              eq(contributionRates.year, currentYear),
            )
          )
          .limit(1);

        const eiRateStr = String(eiRates.employeeRate);
        const eiMaxStr = String(eiRates.maxInsurableEarnings);

        if (existing.length > 0) {
          await db.update(contributionRates)
            .set({
              rate: eiRateStr,
              maxInsurableEarnings: eiMaxStr,
              updatedAt: new Date(),
              syncId,
            })
            .where(eq(contributionRates.id, existing[0].id));
          recordsUpdated++;
        } else {
          await db.insert(contributionRates).values({
            rateType: 'ei_employee',
            rateTypeName: 'Employment Insurance - Employee Rate',
            rate: eiRateStr,
            maxInsurableEarnings: eiMaxStr,
            year: currentYear,
            source: 'Canada Revenue Agency',
            syncId,
          });
          await db.insert(contributionRates).values({
            rateType: 'ei_employer',
            rateTypeName: 'Employment Insurance - Employer Rate',
            rate: String(eiRates.employerRate),
            maxInsurableEarnings: eiMaxStr,
            year: currentYear,
            source: 'Canada Revenue Agency',
            syncId,
          });
          recordsInserted += 2;
        }
      } catch (error) {
        recordsFailed++;
        errors.push(`Failed to sync EI rates: ${error}`);
      }

      try {
        const cppRates = await this.statCanClient.getCPPContributionRates({ year: currentYear });
        recordsProcessed++;

        const existing = await db.select()
          .from(contributionRates)
          .where(
            and(
              eq(contributionRates.rateType, 'cpp_employee'),
              eq(contributionRates.year, currentYear),
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db.update(contributionRates)
            .set({
              rate: String(cppRates.employeeRate),
              exemptionLimit: String(cppRates.exemptionLimit),
              maximumContribution: String(cppRates.maximumContribution),
              updatedAt: new Date(),
              syncId,
            })
            .where(eq(contributionRates.id, existing[0].id));
          recordsUpdated++;
        } else {
          await db.insert(contributionRates).values({
            rateType: 'cpp_employee',
            rateTypeName: 'Canada Pension Plan - Employee Rate',
            rate: String(cppRates.employeeRate),
            exemptionLimit: String(cppRates.exemptionLimit),
            maximumContribution: String(cppRates.maximumContribution),
            year: currentYear,
            source: 'Canada Revenue Agency',
            syncId,
          });
          await db.insert(contributionRates).values({
            rateType: 'cpp_employer',
            rateTypeName: 'Canada Pension Plan - Employer Rate',
            rate: String(cppRates.employerRate),
            exemptionLimit: String(cppRates.exemptionLimit),
            maximumContribution: String(cppRates.maximumContribution),
            year: currentYear,
            source: 'Canada Revenue Agency',
            syncId,
          });
          recordsInserted += 2;
        }
      } catch (error) {
        recordsFailed++;
        errors.push(`Failed to sync CPP rates: ${error}`);
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
      });

      return {
        success: recordsFailed === 0,
        syncId,
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        recordsProcessed,
        recordsInserted,
        recordsUpdated,
        recordsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get wage benchmarks for a CBA
   */
  async getBenchmarksForCBA(params: {
    nocCodes: string[];
    geography: string;
    year?: number;
  }): Promise<EnrichmentResult> {
    const benchmarks: EnrichmentResult['benchmarks'] = [];
    const byIndustry: Record<string, number> = {};

    for (const nocCode of params.nocCodes) {
      const wageData = await this.statCanClient.getMedianHourlyWage({
        nocCode,
        geography: params.geography,
        year: params.year,
      });

      benchmarks.push({
        nocCode,
        medianWage: wageData?.wage || null,
        geography: params.geography,
        year: wageData?.year || new Date().getFullYear(),
      });
    }

    const unionData = await this.statCanClient.getUnionDensity({
      geography: params.geography,
      year: params.year,
    });

    if (unionData.length > 0) {
      const overall = unionData.find(u => u.UnionStatus === 'union_member' && u.Sex === 'B');
      if (overall) {
        byIndustry['overall'] = overall.Value;
      }

      for (const record of unionData) {
        if (record.NAICSName && record.UnionStatus === 'union_member') {
          byIndustry[record.NAICSName] = record.Value;
        }
      }
    }

    const colaData = await this.statCanClient.getCOLAData({
      geography: params.geography,
      startYear: new Date().getFullYear() - 1,
      endYear: new Date().getFullYear(),
    });

    const latestCOLA = colaData[colaData.length - 1];

    return {
      benchmarks,
      unionDensity: {
        overall: byIndustry['overall'] || 0,
        byIndustry,
      },
      inflationRate: latestCOLA?.inflationRate || 0,
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 10) {
    return await db.select()
      .from(externalDataSyncLog)
      .orderBy(desc(externalDataSyncLog.startedAt))
      .limit(limit);
  }

  // Helper methods
  private mapStatisticsToWageType(statistics: string): string {
    const mapping: Record<string, string> = {
      'Average': 'average',
      'Median': 'median',
      'P10': 'p10',
      'P25': 'p25',
      'P50': 'p50',
      'P75': 'p75',
      'P90': 'p90',
    };
    return mapping[statistics] || 'average';
  }

  private getGeographyName(code: string): string {
    const mapping: Record<string, string> = {
      '01': 'Canada',
      '35': 'Ontario',
      '59': 'British Columbia',
      '48': 'Alberta',
      '24': 'Quebec',
      '46': 'Manitoba',
      '47': 'Saskatchewan',
      '12': 'Nova Scotia',
      '13': 'New Brunswick',
      '10': 'Newfoundland and Labrador',
      '11': 'Prince Edward Island',
    };
    return mapping[code] || 'Unknown';
  }
}

// Singleton export
export const wageEnrichmentService = new WageEnrichmentService();

