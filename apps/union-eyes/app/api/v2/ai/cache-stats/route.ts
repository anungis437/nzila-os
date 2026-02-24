/**
 * GET POST /api/ai/cache-stats
 * Migrated to withApi() framework
 */
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import { logger } from '@/lib/logger';
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const aiCacheStatsSchema = z.object({
  action: z.unknown().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    openapi: {
      tags: ['Ai'],
      summary: 'GET cache-stats',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user, body: _body, query: _query }) => {

        // Get cache statistics
        const stats = await embeddingCache.getStats();
          logger.info('Admin viewed embedding cache stats', {
            userId: user?.id,
            stats,
          });
          return { data: {
              ...stats,
              message: stats.hitRate > 0 
                ? `Cache is working! ${stats.hitRate}% of requests are served from cache.`
                : 'No cache hits yet. Cache will improve performance as data is accessed.',
            },
            timestamp: new Date().toISOString(), };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: aiCacheStatsSchema,
    openapi: {
      tags: ['Ai'],
      summary: 'POST cache-stats',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user, body, query: _query }) => {

        // Validate request body
        const { action } = body;
        if (!action || !['clear', 'reset-stats'].includes(action as string)) {
            throw ApiError.badRequest('Invalid action. Use ');
          }
          if (action === 'clear') {
            // Clear all cached embeddings
            const result = await embeddingCache.clearCache();
            logger.warn('Admin cleared embedding cache', {
              userId: user?.id,
              deletedKeys: result.deleted,
            });
            return { message: `Cache cleared. ${result.deleted} embeddings were deleted.`,
              deletedKeys: result.deleted, };
          }
          if (action === 'reset-stats') {
            // Reset cache statistics
            await embeddingCache.resetStats();
            logger.info('Admin reset embedding cache stats', {
              userId: user?.id,
            });
            return { message: 'Cache statistics have been reset to zero.', };
          }
          throw ApiError.badRequest('Unknown action');
  },
);
