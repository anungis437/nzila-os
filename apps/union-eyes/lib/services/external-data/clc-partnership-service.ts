/**
 * CLC Partnership Service
 * 
 * Handles integration with Canadian Labour Congress (CLC) partnership data:
 * - OAuth 2.0 authentication
 * - Per-capita benchmark data sync
 * - Union density statistics
 * - Bargaining trends
 * 
 * Note: This is a template that requires actual partnership with CLC
 * to obtain API credentials and access permissions.
 */

import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { 
  clcPerCapitaBenchmarks, 
  clcUnionDensity, 
  clcBargainingTrends,
  clcSyncLog,
  clcOAuthTokens 
} from '@/db/schema/clc-partnership-schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface CLCClientConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string[];
}

export interface CLCSyncResult {
  success: boolean;
  syncId: string;
  syncType: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
  duration: number;
}

export interface CLCBenchmarkComparison {
  organizationId: string;
  organizationName: string;
  fiscalYear: number;
  perCapitaRate: number;
  nationalAverage: number;
  provincialAverage: number;
  percentileRank: number;
  sizeCategory: string;
  sector: string;
}

// =============================================================================
// CLC OAUTH CLIENT
// =============================================================================

class CLC_OAuthClient {
  private config: CLCClientConfig;
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor() {
    this.config = {
      clientId: process.env.CLC_CLIENT_ID || '',
      clientSecret: process.env.CLC_CLIENT_SECRET || '',
      tokenUrl: process.env.CLC_TOKEN_URL || 'https://api.clc.ca/oauth/token',
      apiBaseUrl: process.env.CLC_API_URL || 'https://api.clc.ca/v1',
      scopes: [
        'per_capita:read',
        'union_density:read',
        'bargaining_trends:read',
        'benchmark:read',
      ],
    };
  }

  /**
   * Get or refresh OAuth access token
   */
  async getAccessToken(): Promise<string | null> {
    // Check cache first
    const cached = this.tokenCache.get('default');
    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }

    // Check database for existing valid token
    const dbToken = await db.select()
      .from(clcOAuthTokens)
      .where(eq(clcOAuthTokens.isActive, true))
      .orderBy(desc(clcOAuthTokens.lastUsedAt))
      .limit(1);

    if (dbToken.length > 0) {
      const token = dbToken[0];
      if (token.expiresAt && token.expiresAt > new Date()) {
        // Cache and return
        this.tokenCache.set('default', {
          token: token.accessToken,
          expiresAt: token.expiresAt,
        });
        
        // Update last used
        await db.update(clcOAuthTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(clcOAuthTokens.id, token.id));
        
        return token.accessToken;
      }
    }

    // No valid token, need to refresh or get new one
    if (dbToken.length > 0 && dbToken[0].refreshToken) {
      try {
        const newToken = await this.refreshToken(dbToken[0].refreshToken);
        return newToken;
      } catch (error) {
        logger.error('[CLC] Token refresh failed:', error);
      }
    }

    logger.warn('[CLC] No valid OAuth token available');
    return null;
  }

  /**
   * Refresh an access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<string> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: this.config.scopes.join(' '),
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Store new token
    await this.storeToken(data);
    
    return data.access_token;
  }

  /**
   * Store OAuth token in database
   */
  async storeToken(tokenData: {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await db.insert(clcOAuthTokens).values({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      tokenType: tokenData.token_type,
      scopes: tokenData.scope || JSON.stringify(this.config.scopes),
      expiresAt,
      refreshExpiresAt: tokenData.refresh_token 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        : null,
      isActive: true,
    });

    // Cache the new token
    this.tokenCache.set('default', {
      token: tokenData.access_token,
      expiresAt,
    });
  }

  /**
   * Make authenticated API request
   */
  async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated with CLC API');
    }

    const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CLC API error (${response.status}): ${error}`);
    }

    return response.json();
  }
}

// =============================================================================
// CLC PARTNERSHIP SERVICE
// =============================================================================

export class CLCPartnershipService {
  private oauthClient: CLC_OAuthClient;

  constructor() {
    this.oauthClient = new CLC_OAuthClient();
  }

  private generateSyncId(): string {
    return `clc_sync_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }

  private async createSyncLog(
    syncType: string,
    initiatedBy?: string
  ): Promise<string> {
    const syncId = this.generateSyncId();
    
    await db.insert(clcSyncLog).values({
      syncType,
      syncId,
      status: 'running',
      initiatedBy,
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
    await db.update(clcSyncLog)
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
      .where(eq(clcSyncLog.syncId, syncId));
  }

  /**
   * Sync per-capita benchmark data
   */
  async syncPerCapitaBenchmarks(params: {
    fiscalYear?: number;
    jurisdiction?: string;
  }): Promise<CLCSyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('per_capita', 'system');

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[CLC] Starting per-capita benchmarks sync', { syncId, params });

      // Note: This is a template - actual implementation would call CLC API
      // const data = await this.oauthClient.apiRequest('/per-capita/benchmarks', {
      //   params: { year: params.fiscalYear, jurisdiction: params.jurisdiction }
      // });

      // Simulated data for template
      const mockData = [
        {
          organizationId: 'CLC-001',
          organizationName: 'Sample Provincial Union',
          organizationType: 'provincial',
          fiscalYear: params.fiscalYear || new Date().getFullYear(),
          totalMembers: 50000,
          duesPayingMembers: 45000,
          perCapitaRate: 0.0125,
          nationalAverageRate: 0.0130,
          provincialAverageRate: 0.0128,
          percentileRank: 45,
        },
      ];

      for (const record of mockData) {
        try {
          recordsProcessed++;

          const existing = await db.select()
            .from(clcPerCapitaBenchmarks)
            .where(
              and(
                eq(clcPerCapitaBenchmarks.organizationId, record.organizationId),
                eq(clcPerCapitaBenchmarks.fiscalYear, record.fiscalYear),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(clcPerCapitaBenchmarks)
              .set({
                totalMembers: record.totalMembers,
                duesPayingMembers: record.duesPayingMembers,
                perCapitaRate: String(record.perCapitaRate),
                nationalAverageRate: String(record.nationalAverageRate),
                provincialAverageRate: String(record.provincialAverageRate),
                percentileRank: record.percentileRank,
                updatedAt: new Date(),
                syncId,
              })
              .where(eq(clcPerCapitaBenchmarks.id, existing[0].id));
            recordsUpdated++;
          } else {
            await db.insert(clcPerCapitaBenchmarks).values({
              organizationId: record.organizationId,
              organizationName: record.organizationName,
              organizationType: record.organizationType,
              fiscalYear: record.fiscalYear,
              totalMembers: record.totalMembers,
              duesPayingMembers: record.duesPayingMembers,
              perCapitaRate: String(record.perCapitaRate),
              nationalAverageRate: String(record.nationalAverageRate),
              provincialAverageRate: String(record.provincialAverageRate),
              percentileRank: record.percentileRank,
              syncId,
            });
            recordsInserted++;
          }
        } catch (error) {
          recordsFailed++;
          errors.push(`Failed to process benchmark: ${error}`);
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
        syncType: 'per_capita',
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
    year?: number;
    jurisdiction?: string;
  }): Promise<CLCSyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('union_density', 'system');

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[CLC] Starting union density sync', { syncId, params });

      // Simulated data
      const mockData = [
        {
          sector: 'Health Care',
          subSector: 'Hospitals',
          jurisdiction: params.jurisdiction || 'ON',
          year: params.year || new Date().getFullYear(),
          totalWorkforce: 500000,
          unionMembers: 350000,
          densityPercent: 70.0,
          nationalDensity: 65.0,
        },
      ];

      for (const record of mockData) {
        try {
          recordsProcessed++;

          const existing = await db.select()
            .from(clcUnionDensity)
            .where(
              and(
                eq(clcUnionDensity.sector, record.sector),
                eq(clcUnionDensity.jurisdiction, record.jurisdiction),
                eq(clcUnionDensity.year, record.year),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(clcUnionDensity)
              .set({
                totalWorkforce: record.totalWorkforce,
                unionMembers: record.unionMembers,
                densityPercent: String(record.densityPercent),
                nationalDensity: String(record.nationalDensity),
                updatedAt: new Date(),
                syncId,
              })
              .where(eq(clcUnionDensity.id, existing[0].id));
            recordsUpdated++;
          } else {
            await db.insert(clcUnionDensity).values({
              sector: record.sector,
              subSector: record.subSector || null,
              jurisdiction: record.jurisdiction,
              year: record.year,
              totalWorkforce: record.totalWorkforce,
              unionMembers: record.unionMembers,
              densityPercent: String(record.densityPercent),
              nationalDensity: String(record.nationalDensity),
              syncId,
            });
            recordsInserted++;
          }
        } catch (error) {
          recordsFailed++;
          errors.push(`Failed to process union density: ${error}`);
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
        syncType: 'union_density',
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
   * Sync bargaining trends
   */
  async syncBargainingTrends(params: {
    year?: number;
    sector?: string;
  }): Promise<CLCSyncResult> {
    const startTime = Date.now();
    const syncId = await this.createSyncLog('bargaining_trends', 'system');

    let recordsProcessed = 0;
    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      logger.info('[CLC] Starting bargaining trends sync', { syncId, params });

      // Simulated data
      const mockData = [
        {
          sector: params.sector || 'Public Sector',
          year: params.year || new Date().getFullYear(),
          quarter: 4,
          totalAgreements: 150,
          settledAgreements: 140,
          averageWageIncrease: 3.5,
          medianWageIncrease: 3.2,
        },
      ];

      for (const record of mockData) {
        try {
          recordsProcessed++;

          const existing = await db.select()
            .from(clcBargainingTrends)
            .where(
              and(
                eq(clcBargainingTrends.sector, record.sector),
                eq(clcBargainingTrends.year, record.year),
                eq(clcBargainingTrends.quarter, record.quarter),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(clcBargainingTrends)
              .set({
                totalAgreements: record.totalAgreements,
                settledAgreements: record.settledAgreements,
                averageWageIncrease: String(record.averageWageIncrease),
                medianWageIncrease: String(record.medianWageIncrease),
                updatedAt: new Date(),
                syncId,
              })
              .where(eq(clcBargainingTrends.id, existing[0].id));
            recordsUpdated++;
          } else {
            await db.insert(clcBargainingTrends).values({
              sector: record.sector,
              year: record.year,
              quarter: record.quarter,
              totalAgreements: record.totalAgreements,
              settledAgreements: record.settledAgreements,
              averageWageIncrease: String(record.averageWageIncrease),
              medianWageIncrease: String(record.medianWageIncrease),
              syncId,
            });
            recordsInserted++;
          }
        } catch (error) {
          recordsFailed++;
          errors.push(`Failed to process trend: ${error}`);
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
        syncType: 'bargaining_trends',
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
   * Get per-capita benchmarks for comparison
   */
  async getBenchmarkComparison(organizationId: string, fiscalYear?: number) {
    const year = fiscalYear || new Date().getFullYear() - 1;

    const organization = await db.select()
      .from(clcPerCapitaBenchmarks)
      .where(
        and(
          eq(clcPerCapitaBenchmarks.organizationId, organizationId),
          eq(clcPerCapitaBenchmarks.fiscalYear, year),
        )
      )
      .limit(1);

    if (!organization.length) {
      return null;
    }

    // Get national and provincial averages for the year
    const averages = await db.select({
      nationalAvg: sql<number>`AVG(${clcPerCapitaBenchmarks.perCapitaRate})::numeric`,
      provincialAvg: sql<number>`AVG(${clcPerCapitaBenchmarks.perCapitaRate})::numeric`,
    })
    .from(clcPerCapitaBenchmarks)
    .where(eq(clcPerCapitaBenchmarks.fiscalYear, year));

    // Get size category comparison
    const sizeComparison = await db.select({
      sizeCategory: clcPerCapitaBenchmarks.organizationType,
      avgRate: sql<number>`AVG(${clcPerCapitaBenchmarks.perCapitaRate})::numeric`,
    })
    .from(clcPerCapitaBenchmarks)
    .where(eq(clcPerCapitaBenchmarks.fiscalYear, year))
    .groupBy(clcPerCapitaBenchmarks.organizationType);

    return {
      organization: organization[0],
      benchmarks: {
        nationalAverage: averages[0]?.nationalAvg || 0,
        provincialAverage: averages[0]?.provincialAvg || 0,
        sizeComparison,
      },
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 10) {
    return await db.select()
      .from(clcSyncLog)
      .orderBy(desc(clcSyncLog.startedAt))
      .limit(limit);
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const clcPartnershipService = new CLCPartnershipService();

