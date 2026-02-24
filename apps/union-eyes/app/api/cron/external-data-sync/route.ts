/**
 * External Data Sync Cron Job
 * 
 * Purpose: Sync external data (Statistics Canada, LRB, CLC) on scheduled basis
 * Schedule: 
 *   - Wages: Monthly (1st of month at midnight UTC)
 *   - Union Density: Weekly (Sunday at midnight UTC)
 *   - COLA: Monthly (1st of month at midnight UTC)
 *   - Contributions: Weekly (Sunday at midnight UTC)
 * 
 * Vercel Cron Expressions:
 *   - Monthly: "0 0 1 * *" (Midnight UTC on 1st of every month)
 *   - Weekly: "0 0 * * 0" (Midnight UTC on Sunday)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { wageEnrichmentService, type SyncResult } from '@/lib/services/external-data/wage-enrichment-service';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
// Common NOC codes for unionized occupations
const COMMON_NOC_CODES = [
  '6513', // Food and beverage servers
  '6721', // Support occupations in accommodation, travel and facilities
  '7611', // Construction trades helpers and laborers
  '7622', // Public works and maintenance laborers
  '7452', // Ground maintenance workers
  '7535', // Other motor vehicle mechanics
  '7614', // Construction millwrights and industrial mechanics
  '7621', // Railway and motor transport laborers
  '4031', // Secondary school teachers
  '4032', // Elementary and kindergarten teachers
  '3012', // Registered nurses and registered psychiatric nurses
  '3233', // Licensed practical nurses
  '4214', // Early childhood educators and assistants
  '6552', // Other customer and information services representatives
  '6512', // Bartenders
  '7521', // Heavy equipment operators (except crane)
  '7511', // Transport truck drivers
  '7437', // Railroad yard workers
  '7411', // Truck drivers
];

// =============================================================================
// CRON JOB
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Verify cron authorization (timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? '';
  const expected = process.env.CRON_SECRET ?? '';
  const secretBuf = Buffer.from(secret);
  const expectedBuf = Buffer.from(expected);
  if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
    logger.warn('[CRON] Unauthorized external data sync attempt');
    return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
  }

  logger.info('[CRON] Starting external data sync...');

  try {
    const results = {
      timestamp: new Date().toISOString(),
      syncType: 'scheduled',
      dataSources: {
        wages: null as SyncResult | { success: boolean; error: string } | null,
        unionDensity: null as SyncResult | { success: boolean; error: string } | null,
        cola: null as SyncResult | { success: boolean; error: string } | null,
        contributions: null as SyncResult | { success: boolean; error: string } | null,
      },
      summary: {
        totalProcessed: 0,
        totalInserted: 0,
        totalUpdated: 0,
        totalFailed: 0,
        success: true,
        duration: 0,
      },
      errors: [] as string[],
    };

    // Sync wage data (all provinces)
    try {
      logger.info('[CRON] Syncing wage data for all provinces...');
      
      const wageResults = await wageEnrichmentService.syncWageData({
        nocCodes: COMMON_NOC_CODES,
        geography: '01', // Canada national
      });

      results.dataSources.wages = wageResults;
      results.summary.totalProcessed += wageResults.recordsProcessed;
      results.summary.totalInserted += wageResults.recordsInserted;
      results.summary.totalUpdated += wageResults.recordsUpdated;
      results.summary.totalFailed += wageResults.recordsFailed;
      
      if (!wageResults.success) {
        results.errors.push(`Wages sync had ${wageResults.recordsFailed} failures`);
      }

      logger.info('[CRON] Wage data sync complete', {
        processed: wageResults.recordsProcessed,
        inserted: wageResults.recordsInserted,
      });
    } catch (error) {
      const errorMsg = `Wages sync failed: ${error}`;
      logger.error('[CRON]', error);
      results.errors.push(errorMsg);
      results.dataSources.wages = { success: false, error: String(error) };
    }

    // Sync union density data
    try {
      logger.info('[CRON] Syncing union density data...');
      
      const unionResults = await wageEnrichmentService.syncUnionDensity({
        geography: '01', // Canada national
      });

      results.dataSources.unionDensity = unionResults;
      results.summary.totalProcessed += unionResults.recordsProcessed;
      results.summary.totalInserted += unionResults.recordsInserted;
      results.summary.totalUpdated += unionResults.recordsUpdated;
      results.summary.totalFailed += unionResults.recordsFailed;

      if (!unionResults.success) {
        results.errors.push(`Union density sync had ${unionResults.recordsFailed} failures`);
      }

      logger.info('[CRON] Union density sync complete', {
        processed: unionResults.recordsProcessed,
        inserted: unionResults.recordsInserted,
      });
    } catch (error) {
      const errorMsg = `Union density sync failed: ${error}`;
      logger.error('[CRON]', error);
      results.errors.push(errorMsg);
      results.dataSources.unionDensity = { success: false, error: String(error) };
    }

    // Sync COLA data
    try {
      logger.info('[CRON] Syncing COLA data...');
      
      const colaResults = await wageEnrichmentService.syncCOLAData({
        geography: '01', // Canada national
        startYear: new Date().getFullYear() - 2,
        endYear: new Date().getFullYear(),
      });

      results.dataSources.cola = colaResults;
      results.summary.totalProcessed += colaResults.recordsProcessed;
      results.summary.totalInserted += colaResults.recordsInserted;
      results.summary.totalUpdated += colaResults.recordsUpdated;
      results.summary.totalFailed += colaResults.recordsFailed;

      if (!colaResults.success) {
        results.errors.push(`COLA sync had ${colaResults.recordsFailed} failures`);
      }

      logger.info('[CRON] COLA sync complete', {
        processed: colaResults.recordsProcessed,
        inserted: colaResults.recordsInserted,
      });
    } catch (error) {
      const errorMsg = `COLA sync failed: ${error}`;
      logger.error('[CRON]', error);
      results.errors.push(errorMsg);
      results.dataSources.cola = { success: false, error: String(error) };
    }

    // Sync contribution rates (EI, CPP)
    try {
      logger.info('[CRON] Syncing contribution rates...');
      
      const contributionResults = await wageEnrichmentService.syncContributionRates();

      results.dataSources.contributions = contributionResults;
      results.summary.totalProcessed += contributionResults.recordsProcessed;
      results.summary.totalInserted += contributionResults.recordsInserted;
      results.summary.totalUpdated += contributionResults.recordsUpdated;
      results.summary.totalFailed += contributionResults.recordsFailed;

      if (!contributionResults.success) {
        results.errors.push(`Contributions sync had ${contributionResults.recordsFailed} failures`);
      }

      logger.info('[CRON] Contribution rates sync complete', {
        processed: contributionResults.recordsProcessed,
        inserted: contributionResults.recordsInserted,
      });
    } catch (error) {
      const errorMsg = `Contributions sync failed: ${error}`;
      logger.error('[CRON]', error);
      results.errors.push(errorMsg);
      results.dataSources.contributions = { success: false, error: String(error) };
    }

    // Determine overall success
    results.summary.success = results.errors.length === 0;
    results.summary.duration = Date.now() - startTime;

    logger.info('[CRON] External data sync complete', {
      success: results.summary.success,
      totalProcessed: results.summary.totalProcessed,
      totalInserted: results.summary.totalInserted,
      duration: results.summary.duration,
    });

    return NextResponse.json(results);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[CRON] Fatal error in external data sync:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        message: errorMsg,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}

