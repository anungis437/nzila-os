/**
 * Member Segment item route
 *
 * GET    /api/members/segments/[id]   — get a single segment
 * PATCH  /api/members/segments/[id]   — update a segment
 * DELETE /api/members/segments/[id]   — delete a segment
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { memberSegments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['Members'], summary: 'Get a member segment' },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [segment] = await db
      .select()
      .from(memberSegments)
      .where(
        and(
          eq(memberSegments.id, params.id),
          eq(memberSegments.organizationId, organizationId),
        ),
      );

    if (!segment) throw ApiError.notFound('Segment not found');
    return { data: segment };
  },
);

export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Members'], summary: 'Update a member segment' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const body = await request.json();
    const { name, description, filters } = body as {
      name?: string;
      description?: string;
      filters?: any;
    };

    const updateValues: Partial<typeof memberSegments.$inferInsert> = {};
    if (name !== undefined) updateValues.name = name;
    if (description !== undefined) updateValues.description = description;
    if (filters !== undefined) updateValues.filters = filters as NonNullable<typeof updateValues['filters']>;

    if (Object.keys(updateValues).length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    return withRLSContext({ organizationId }, async (tx) => {
      const [updated] = await tx
        .update(memberSegments)
        .set(updateValues)
        .where(and(eq(memberSegments.id, params.id), eq(memberSegments.organizationId, organizationId)))
        .returning();

      if (!updated) throw ApiError.notFound('Segment not found');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'member.segment.update',
        resourceType: 'member_segments',
        resourceId: params.id,
        details: { fields: Object.keys(updateValues) },
      });
      return { data: updated };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Members'], summary: 'Delete a member segment' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    await withRLSContext({ organizationId }, async (tx) => {
      const deleted = await tx
        .delete(memberSegments)
        .where(and(eq(memberSegments.id, params.id), eq(memberSegments.organizationId, organizationId)))
        .returning({ id: memberSegments.id, name: memberSegments.name });

      if (deleted.length === 0) throw ApiError.notFound('Segment not found');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'member.segment.delete',
        resourceType: 'member_segments',
        resourceId: params.id,
        details: { name: deleted[0].name },
      });
    });

    return new NextResponse(null, { status: 204 });
  },
);


