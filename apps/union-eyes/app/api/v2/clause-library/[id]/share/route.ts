/**
 * GET POST /api/v2/clause-library/[id]/share
 * Direct DB — replaces Django proxy
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { z } from 'zod';

const updateSharingSchema = z.object({
  sharingLevel: z.enum(['private', 'local', 'national', 'public']).optional(),
  sharedWithOrgIds: z.array(z.string().uuid()).optional(),
  isAnonymized: z.boolean().optional(),
  anonymizedEmployerName: z.string().max(200).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get sharing info for a clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];
    return withSystemContext(async () => {
      const [clause] = await db.select({
        id: sharedClauseLibrary.id, sharingLevel: sharedClauseLibrary.sharingLevel,
        sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds, isAnonymized: sharedClauseLibrary.isAnonymized,
        anonymizedEmployerName: sharedClauseLibrary.anonymizedEmployerName,
        sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
      }).from(sharedClauseLibrary).where(eq(sharedClauseLibrary.id, id)).limit(1);
      if (!clause) throw ApiError.notFound('clause', id);
      return { sharing: clause };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Update sharing settings for a clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];
    const raw = await request.json();
    const body = updateSharingSchema.parse(raw);
    const updates: Record<string, unknown> = {};
    if (body.sharingLevel !== undefined) updates.sharingLevel = body.sharingLevel;
    if (body.sharedWithOrgIds !== undefined) updates.sharedWithOrgIds = body.sharedWithOrgIds;
    if (body.isAnonymized !== undefined) updates.isAnonymized = body.isAnonymized;
    if (body.anonymizedEmployerName !== undefined) updates.anonymizedEmployerName = body.anonymizedEmployerName;
    if (Object.keys(updates).length === 0) throw ApiError.badRequest('No sharing fields to update');
    return withSystemContext(async () => {
      const [clause] = await db.select({ id: sharedClauseLibrary.id }).from(sharedClauseLibrary).where(eq(sharedClauseLibrary.id, id)).limit(1);
      if (!clause) throw ApiError.notFound('clause', id);
      const [updated] = await db.update(sharedClauseLibrary).set({ ...updates, updatedAt: new Date() }).where(eq(sharedClauseLibrary.id, id)).returning();
      return { sharing: { id: updated.id, sharingLevel: updated.sharingLevel, sharedWithOrgIds: updated.sharedWithOrgIds, isAnonymized: updated.isAnonymized, anonymizedEmployerName: updated.anonymizedEmployerName } };
    });
  },
);
