import { db } from '@/db/db';
import { kpiConfigurations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const PATCH = withApi(
  {
    auth: { minRole: 'officer' },
    body: z.object({
      isActive: z.boolean(),
    }),
  },
  async ({ body, organizationId, params }) => {
    const { id } = params;

    const [updated] = await db
      .update(kpiConfigurations)
      .set({
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(kpiConfigurations.id, id),
          eq(kpiConfigurations.organizationId, organizationId!),
        ),
      )
      .returning();

    if (!updated) {
      throw ApiError.notFound('Target');
    }

    return updated;
  },
);
