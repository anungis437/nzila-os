/**
 * GET PATCH /api/v2/admin/feature-flags
 * Feature flag management (admin-only)
 */
import { db } from '@/db';
import { featureFlags } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { withApi, ApiError, z } from '@/lib/api/framework';

const toggleFlagSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'GET feature-flags',
    },
  },
  async () => {
    const flags = await db.select().from(featureFlags);
    return { success: true, data: flags };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: toggleFlagSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'PATCH feature-flags',
    },
  },
  async ({ body, userId }) => {
    const existing = await db.select().from(featureFlags).where(eq(featureFlags.name, body.name));
    if (existing.length === 0) {
      throw ApiError.notFound(`Feature flag "${body.name}" not found.`);
    }
    const [updated] = await db
      .update(featureFlags)
      .set({ enabled: body.enabled, updatedAt: new Date(), lastModifiedBy: userId })
      .where(eq(featureFlags.name, body.name))
      .returning();
    return { success: true, data: updated };
  },
);
