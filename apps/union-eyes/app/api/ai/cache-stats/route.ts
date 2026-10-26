/**
 * AI Embedding Cache Statistics API
 * 
 * Admin-only endpoint to view embedding cache performance and cost savings.
 * 
 * Returns:
 * - Total embedding requests
 * - Cache hits and misses
 * - Cache hit rate (percentage)
 * - Estimated cost savings (USD)
 * 
 * Authentication: Requires admin role (role >= 90)
 * 
 * Created: February 11, 2026
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, withSystemAdminAuth, getCurrentUser, type BaseAuthContext } from '@/lib/api-auth-guard';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import { logger } from '@/lib/logger';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * GET /api/ai/cache-stats
 * 
 * Get embedding cache statistics
 * Requires admin role
 */
export const GET = withAdminAuth(async (_request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    
    // Get cache statistics
    const stats = await embeddingCache.getStats();

      logger.info('Admin viewed embedding cache stats', {
        userId: user?.id,
        stats,
      });

      return NextResponse.json({
        success: true,
        data: {
          ...stats,
          message: stats.hitRate > 0 
            ? `Cache is working! ${stats.hitRate}% of requests are served from cache.`
            : 'No cache hits yet. Cache will improve performance as data is accessed.',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch embedding cache stats', error);

      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to fetch cache statistics',
        },
        { status: 500 }
      );
    }
  });

/**
 * POST /api/ai/cache-stats
 * 
 * Platform action to clear the cache or reset its stats. The embedding cache is shared by every organization, so the
 * action is not an organization administrator's to take: it requires a system administrator.
 */

const aiCacheStatsSchema = z.object({
  action: z.enum(['clear', 'reset-stats']).optional(),
});

export const POST = withSystemAdminAuth(async (request: NextRequest, context: BaseAuthContext) => {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    // Validate request body
    const validation = aiCacheStatsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    const { action } = validation.data;

      if (!action || !['clear', 'reset-stats'].includes(action)) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid action. Use "clear" or "reset-stats"',
          },
          { status: 400 }
        );
      }

      // The cache lives outside the database, so the intent is recorded first and the action is skipped if that
      // record cannot be written.
      const audited = <T>(operation: () => Promise<T>) =>
        performAuditedOperation(
          {
            organizationId: context.organizationId,
            userId: context.userId,
            action: `ai.embedding_cache.${action}`,
            resourceType: 'embedding_cache',
          },
          operation,
        );

      if (action === 'clear') {
        // Clear all cached embeddings
        const result = await audited(() => embeddingCache.clearCache());

        logger.warn('Admin cleared embedding cache', {
          userId: user?.id,
          deletedKeys: result.deleted,
        });

        return NextResponse.json({
          success: true,
          message: `Cache cleared. ${result.deleted} embeddings were deleted.`,
          deletedKeys: result.deleted,
        });
      }

      if (action === 'reset-stats') {
        // Reset cache statistics
        await audited(() => embeddingCache.resetStats());

        logger.info('Admin reset embedding cache stats', {
          userId: user?.id,
        });

        return NextResponse.json({
          success: true,
          message: 'Cache statistics have been reset to zero.',
        });
      }

      return NextResponse.json(
        { success: false, error: 'Unknown action' },
        { status: 400 }
      );
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      logger.error('Failed to execute cache action', error);

      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to execute cache action',
        },
        { status: 500 }
      );
    }
  });
