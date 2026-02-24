/**
 * Unified LRB Service
 * 
 * Provides a unified interface to access collective agreement data from
 * various Provincial Labour Relations Boards:
 * - Ontario LRB (https://www.olrb.gov.on.ca/)
 * - BC LRB (https://www.lrb.bc.ca/)
 * 
 * Features:
 * - Fetch and sync agreements from multiple sources
 * - Search agreements by employer, union, keyword
 * - Get wage comparisons across agreements
 * - Track sync history and data freshness
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import {
  lrbAgreements,
  lrbSyncLog,
} from '@/db/schema/lrb-agreements-schema';
import { eq, and, desc, like, sql, type SQL } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface LRBSearchParams {
  source?: 'ontario_lrb' | 'bc_lrb' | 'federal_lrb';
  employerName?: string;
  unionName?: string;
  jurisdiction?: string;
  sector?: string;
  status?: string;
  nocCode?: string;
  keyword?: string;
  page?: number;
  limit?: number;
}

export interface LRBSyncResult {
  success: boolean;
  syncId: string;
  source: string;
  agreementsFound: number;
  agreementsInserted: number;
  agreementsUpdated: number;
  agreementsFailed: number;
  errors: string[];
  duration: number;
}

export interface AgreementComparison {
  employerName: string;
  unionName: string;
  sector: string | null;
  jurisdiction: string;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  hourlyWageRange: string | null;
  annualSalaryRange: string | null;
  source: string;
}

// =============================================================================
// ONTARIO LRB CLIENT
// =============================================================================

class OntarioLRBClient {
  private baseUrl = 'https://www.olrb.gov.on.ca';
  
  /**
   * Fetch agreements from Ontario LRB
   * Note: This is a placeholder - actual implementation would use their API or scraping
   */
  async fetchAgreements(params: {
    page?: number;
    employerName?: string;
    unionName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    // Placeholder: In production, this would call the actual Ontario LRB API
    // or scrape their website using puppeteer/cheerio
    
    logger.info('[LRB] Fetching Ontario LRB agreements', params);
    
    // Simulated response structure
    return [
      {
        sourceId: 'OLRB-2024-001',
        employerName: 'Ontario Public Service Employees Union',
        employerAddress: '1000 Yonge Street, Toronto, ON',
        unionName: 'Ontario Public Service Employees Union',
        unionCode: 'OPSEU',
        bargainingUnit: 'All Employees',
        bargainingUnitSize: 150,
        effectiveDate: '2024-01-01',
        expiryDate: '2025-12-31',
        sector: 'public',
        jurisdiction: 'ON',
        hourlyWageRange: '$25.00 - $45.00',
        annualSalaryRange: '$52,000 - $94,000',
        pdfUrl: 'https://www.olrb.gov.on.ca/agreements/2024-001.pdf',
      },
    ];
  }
}

// =============================================================================
// BC LRB CLIENT
// =============================================================================

class BCLRBClient {
  private baseUrl = 'https://www.lrb.bc.ca';
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.BC_LRB_API_KEY;
  }
  
  /**
   * Fetch agreements from BC LRB
   * Note: BC LRB has a bulk data API available
   */
  async fetchAgreements(params: {
    page?: number;
    employerName?: string;
    unionName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    logger.info('[LRB] Fetching BC LRB agreements', params);
    
    // Placeholder: In production, this would call the BC LRB API
    return [
      {
        sourceId: 'BCLRB-2024-001',
        employerName: 'BC Public Service Agency',
        employerAddress: '4000 Seymour Place, Victoria, BC',
        unionName: 'BC Government and Service Employees Union',
        unionCode: 'BCGSEU',
        bargainingUnit: 'Core Public Administration',
        bargainingUnitSize: 250,
        effectiveDate: '2024-04-01',
        expiryDate: '2026-03-31',
        sector: 'public',
        jurisdiction: 'BC',
        hourlyWageRange: '$28.00 - $52.00',
        annualSalaryRange: '$58,000 - $108,000',
        pdfUrl: 'https://www.lrb.bc.ca/agreements/2024-001.pdf',
      },
    ];
  }
}

// =============================================================================
// UNIFIED LRB SERVICE
// =============================================================================

export class UnifiedLRBService {
  private ontarioClient: OntarioLRBClient;
  private bcClient: BCLRBClient;

  constructor() {
    this.ontarioClient = new OntarioLRBClient();
    this.bcClient = new BCLRBClient();
  }

  /**
   * Generate a unique sync ID
   */
  private generateSyncId(): string {
    return `lrb_sync_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  /**
   * Create a sync log entry
   */
  private async createSyncLog(
    source: string,
    syncType: 'full' | 'incremental' | 'manual' = 'full'
  ): Promise<string> {
    const syncId = this.generateSyncId();
    
    await db.insert(lrbSyncLog).values({
      source,
      syncId,
      status: 'running',
      syncType,
    });

    return syncId;
  }

  /**
   * Update sync log with results
   */
  private async updateSyncLog(
    syncId: string,
    result: {
      status: 'completed' | 'failed';
      agreementsFound: number;
      agreementsInserted: number;
      agreementsUpdated: number;
      agreementsFailed: number;
      errorMessage?: string;
      errorDetails?: string;
    }
  ): Promise<void> {
    await db.update(lrbSyncLog)
      .set({
        status: result.status,
        agreementsFound: result.agreementsFound,
        agreementsInserted: result.agreementsInserted,
        agreementsUpdated: result.agreementsUpdated,
        agreementsFailed: result.agreementsFailed,
        errorMessage: result.errorMessage,
        errorDetails: result.errorDetails,
        completedAt: new Date(),
      })
      .where(eq(lrbSyncLog.syncId, syncId));
  }

  /**
   * Sync Ontario LRB data
   */
  async syncOntario(): Promise<LRBSyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('ontario_lrb', 'full');

    let agreementsFound = 0;
    let agreementsInserted = 0;
    let agreementsUpdated = 0;
    let agreementsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[LRB] Starting Ontario LRB sync', { syncId });

      const agreements = await this.ontarioClient.fetchAgreements({});
      agreementsFound = agreements.length;

      for (const agreement of agreements) {
        try {
          const existing = await db.select()
            .from(lrbAgreements)
            .where(
              and(
                eq(lrbAgreements.source, 'ontario_lrb'),
                eq(lrbAgreements.sourceId, agreement.sourceId),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(lrbAgreements)
              .set({
                employerName: agreement.employerName,
                employerAddress: agreement.employerAddress,
                unionName: agreement.unionName,
                unionCode: agreement.unionCode,
                bargainingUnit: agreement.bargainingUnit,
                bargainingUnitSize: agreement.bargainingUnitSize,
                effectiveDate: new Date(agreement.effectiveDate),
                expiryDate: new Date(agreement.expiryDate),
                sector: agreement.sector,
                jurisdiction: agreement.jurisdiction,
                hourlyWageRange: agreement.hourlyWageRange,
                annualSalaryRange: agreement.annualSalaryRange,
                pdfUrl: agreement.pdfUrl,
                updatedAt: new Date(),
                lastSyncedAt: new Date(),
                syncId,
              })
              .where(eq(lrbAgreements.id, existing[0].id));
            agreementsUpdated++;
          } else {
            await db.insert(lrbAgreements).values({
              source: 'ontario_lrb',
              sourceId: agreement.sourceId,
              employerName: agreement.employerName,
              employerAddress: agreement.employerAddress,
              unionName: agreement.unionName,
              unionCode: agreement.unionCode,
              bargainingUnit: agreement.bargainingUnit,
              bargainingUnitSize: agreement.bargainingUnitSize,
              effectiveDate: new Date(agreement.effectiveDate),
              expiryDate: new Date(agreement.expiryDate),
              sector: agreement.sector,
              jurisdiction: agreement.jurisdiction,
              hourlyWageRange: agreement.hourlyWageRange,
              annualSalaryRange: agreement.annualSalaryRange,
              pdfUrl: agreement.pdfUrl,
              status: 'active',
              syncId,
            });
            agreementsInserted++;
          }
        } catch (error) {
          agreementsFailed++;
          errors.push(`Failed to process agreement ${agreement.sourceId}: ${error}`);
        }
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
      });

      logger.info('[LRB] Ontario sync complete', {
        syncId,
        found: agreementsFound,
        inserted: agreementsInserted,
        updated: agreementsUpdated,
        failed: agreementsFailed,
      });

      return {
        success: agreementsFailed === 0,
        syncId,
        source: 'ontario_lrb',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sync BC LRB data
   */
  async syncBC(): Promise<LRBSyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('bc_lrb', 'full');

    let agreementsFound = 0;
    let agreementsInserted = 0;
    let agreementsUpdated = 0;
    let agreementsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[LRB] Starting BC LRB sync', { syncId });

      const agreements = await this.bcClient.fetchAgreements({});
      agreementsFound = agreements.length;

      for (const agreement of agreements) {
        try {
          const existing = await db.select()
            .from(lrbAgreements)
            .where(
              and(
                eq(lrbAgreements.source, 'bc_lrb'),
                eq(lrbAgreements.sourceId, agreement.sourceId),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(lrbAgreements)
              .set({
                employerName: agreement.employerName,
                employerAddress: agreement.employerAddress,
                unionName: agreement.unionName,
                unionCode: agreement.unionCode,
                bargainingUnit: agreement.bargainingUnit,
                bargainingUnitSize: agreement.bargainingUnitSize,
                effectiveDate: new Date(agreement.effectiveDate),
                expiryDate: new Date(agreement.expiryDate),
                sector: agreement.sector,
                jurisdiction: agreement.jurisdiction,
                hourlyWageRange: agreement.hourlyWageRange,
                annualSalaryRange: agreement.annualSalaryRange,
                pdfUrl: agreement.pdfUrl,
                updatedAt: new Date(),
                lastSyncedAt: new Date(),
                syncId,
              })
              .where(eq(lrbAgreements.id, existing[0].id));
            agreementsUpdated++;
          } else {
            await db.insert(lrbAgreements).values({
              source: 'bc_lrb',
              sourceId: agreement.sourceId,
              employerName: agreement.employerName,
              employerAddress: agreement.employerAddress,
              unionName: agreement.unionName,
              unionCode: agreement.unionCode,
              bargainingUnit: agreement.bargainingUnit,
              bargainingUnitSize: agreement.bargainingUnitSize,
              effectiveDate: new Date(agreement.effectiveDate),
              expiryDate: new Date(agreement.expiryDate),
              sector: agreement.sector,
              jurisdiction: agreement.jurisdiction,
              hourlyWageRange: agreement.hourlyWageRange,
              annualSalaryRange: agreement.annualSalaryRange,
              pdfUrl: agreement.pdfUrl,
              status: 'active',
              syncId,
            });
            agreementsInserted++;
          }
        } catch (error) {
          agreementsFailed++;
          errors.push(`Failed to process agreement ${agreement.sourceId}: ${error}`);
        }
      }

      await this.updateSyncLog(syncId, {
        status: 'completed',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
      });

      logger.info('[LRB] BC sync complete', {
        syncId,
        found: agreementsFound,
        inserted: agreementsInserted,
        updated: agreementsUpdated,
        failed: agreementsFailed,
      });

      return {
        success: agreementsFailed === 0,
        syncId,
        source: 'bc_lrb',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateSyncLog(syncId, {
        status: 'failed',
        agreementsFound,
        agreementsInserted,
        agreementsUpdated,
        agreementsFailed,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sync all LRB sources
   */
  async syncAll(): Promise<{
    ontario: LRBSyncResult;
    bc: LRBSyncResult;
    totalInserted: number;
    totalUpdated: number;
  }> {
    const ontario = await this.syncOntario();
    const bc = await this.syncBC();

    return {
      ontario,
      bc,
      totalInserted: ontario.agreementsInserted + bc.agreementsInserted,
      totalUpdated: ontario.agreementsUpdated + bc.agreementsUpdated,
    };
  }

  /**
   * Search agreements
   */
  async search(params: LRBSearchParams): Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agreements: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    
    if (params.source) {
      conditions.push(eq(lrbAgreements.source, params.source));
    }
    if (params.employerName) {
      conditions.push(like(lrbAgreements.employerName, `%${params.employerName}%`));
    }
    if (params.unionName) {
      conditions.push(like(lrbAgreements.unionName, `%${params.unionName}%`));
    }
    if (params.jurisdiction) {
      conditions.push(eq(lrbAgreements.jurisdiction, params.jurisdiction));
    }
    if (params.sector) {
      conditions.push(eq(lrbAgreements.sector, params.sector));
    }
    if (params.status) {
      conditions.push(eq(lrbAgreements.status, params.status));
    }

    const whereCondition = conditions.length > 0 
      ? and(...conditions)
      : undefined;

    const agreements = await db.select()
      .from(lrbAgreements)
      .where(whereCondition)
      .orderBy(desc(lrbAgreements.effectiveDate))
      .limit(limit)
      .offset(offset);

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(lrbAgreements)
      .where(whereCondition);

    const total = Number(totalResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return {
      agreements,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Get agreement by ID
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getById(id: string): Promise<any> {
    const result = await db.select()
      .from(lrbAgreements)
      .where(eq(lrbAgreements.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get wage comparisons for an occupation
   */
  async getWageComparisons(nocCode: string, jurisdiction?: string): Promise<AgreementComparison[]> {
    const conditions: SQL[] = [];
    
    if (jurisdiction) {
      conditions.push(eq(lrbAgreements.jurisdiction, jurisdiction));
    }

    const whereCondition = conditions.length > 0
      ? and(eq(lrbAgreements.status, 'active'), ...conditions)
      : eq(lrbAgreements.status, 'active');

    const result = await db.select({
      employerName: lrbAgreements.employerName,
      unionName: lrbAgreements.unionName,
      sector: lrbAgreements.sector,
      jurisdiction: lrbAgreements.jurisdiction,
      effectiveDate: lrbAgreements.effectiveDate,
      expiryDate: lrbAgreements.expiryDate,
      hourlyWageRange: lrbAgreements.hourlyWageRange,
      annualSalaryRange: lrbAgreements.annualSalaryRange,
      source: lrbAgreements.source,
    })
    .from(lrbAgreements)
    .where(whereCondition)
    .orderBy(desc(lrbAgreements.effectiveDate))
    .limit(50);

    return result;
  }

  /**
   * Get sync history
   */
  async getSyncHistory(source?: string, limit: number = 10) {
    const condition = source 
      ? eq(lrbSyncLog.source, source)
      : undefined;

    return await db.select()
      .from(lrbSyncLog)
      .where(condition)
      .orderBy(desc(lrbSyncLog.startedAt))
      .limit(limit);
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const bySource = await db.select({
      source: lrbAgreements.source,
      count: sql<number>`count(*)`,
    })
    .from(lrbAgreements)
    .groupBy(lrbAgreements.source);

    const byStatus = await db.select({
      status: lrbAgreements.status,
      count: sql<number>`count(*)`,
    })
    .from(lrbAgreements)
    .groupBy(lrbAgreements.status);

    const byJurisdiction = await db.select({
      jurisdiction: lrbAgreements.jurisdiction,
      count: sql<number>`count(*)`,
    })
    .from(lrbAgreements)
    .groupBy(lrbAgreements.jurisdiction);

    return {
      bySource,
      byStatus,
      byJurisdiction,
      totalAgreements: bySource.reduce((sum, s) => sum + Number(s.count), 0),
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const unifiedLRBService = new UnifiedLRBService();

