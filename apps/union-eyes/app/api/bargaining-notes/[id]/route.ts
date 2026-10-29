/**
 * Bargaining note item access matches the confidentiality policy of the
 * collection service; direct UUID lookup must never bypass it.
 */
import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { db } from '@/db/db';
import { bargainingNotes } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, eq, inArray, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const publicOrAuthor = (userId: string) => or(
  inArray(bargainingNotes.confidentialityLevel, ['public', 'internal']),
  eq(bargainingNotes.createdBy, userId),
);
const ownNote = (organizationId: string, userId: string, id: string) => and(
  eq(bargainingNotes.id, id),
  eq(bargainingNotes.organizationId, organizationId),
  eq(bargainingNotes.createdBy, userId),
);

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  rlsOrgContext: true,
  openapi: { tags: ['Bargaining'], summary: 'Read note subject to confidentiality and tenant scope' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization identity required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid bargaining note id');
  const [note] = await db.select().from(bargainingNotes).where(and(
    eq(bargainingNotes.id, parsed.data),
    eq(bargainingNotes.organizationId, organizationId),
    publicOrAuthor(userId),
  )).limit(1);
  if (!note) throw ApiError.notFound('Bargaining note not found');
  return { data: note };
});

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).optional(),
  sessionType: z.string().min(1).max(100).optional(),
  confidentialityLevel: z.enum(['public', 'internal', 'restricted', 'confidential']).optional(),
  tags: z.array(z.string().max(100)).max(30).optional(),
}).strict().refine((body) => Object.keys(body).length > 0);

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  body: patchSchema,
  requireOrg: true,
  openapi: { tags: ['Bargaining'], summary: 'Edit own bargaining note' },
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization identity required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid bargaining note id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [existing] = await tx.select({ id: bargainingNotes.id })
      .from(bargainingNotes).where(ownNote(organizationId, userId, parsed.data))
      .limit(1).for('update');
    if (!existing) throw ApiError.notFound('Bargaining note not found');
    const [updated] = await tx.update(bargainingNotes)
      .set({ ...body, lastModifiedBy: userId, updatedAt: new Date() })
      .where(ownNote(organizationId, userId, parsed.data))
      .returning();
    if (!updated) throw ApiError.conflict('Bargaining note changed');
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'bargaining.note.update',
      resourceType: 'bargaining_notes',
      resourceId: parsed.data,
      details: { changedFields: Object.keys(body) },
    });
    return { data: updated };
  });
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Bargaining'], summary: 'Delete authored bargaining note with audit' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization identity required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid bargaining note id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [deleted] = await tx.delete(bargainingNotes)
      .where(ownNote(organizationId, userId, parsed.data))
      .returning({ id: bargainingNotes.id });
    if (!deleted) throw ApiError.notFound('Bargaining note not found');
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'bargaining.note.delete',
      resourceType: 'bargaining_notes',
      resourceId: parsed.data,
      details: { actorWasAuthor: true },
    });
    return { deleted: true, id: deleted.id };
  });
});
