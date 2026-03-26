/**
 * Employer Remittance Item Route
 *
 * GET   /api/dues/remittances/:id — Retrieve a specific employer remittance
 * PATCH /api/dues/remittances/:id — Update remittance status/notes/reconciliation
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db';
import { employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Get an employer remittance by ID' },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const [remittance] = await db
      .select()
      .from(employerRemittances)
      .where(and(eq(employerRemittances.id, id), eq(employerRemittances.organizationId, organizationId)));

    if (!remittance) throw ApiError.notFound('Remittance not found');

    return { data: remittance };
  },
);

const patchSchema = z.object({
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'requires_review']).optional(),
  notes: z.string().optional(),
  isReconciled: z.boolean().optional(),
  reconciledAt: z.coerce.date().optional(),
  reconciledBy: z.string().optional(),
  expectedAmount: z.string().optional(),
  variance: z.string().optional(),
  recordsTotal: z.number().int().optional(),
  recordsProcessed: z.number().int().optional(),
  recordsMatched: z.number().int().optional(),
  recordsException: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Dues'], summary: 'Update an employer remittance' },
  },
  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const body = patchSchema.parse(await request.json());

    const [existing] = await db
      .select()
      .from(employerRemittances)
      .where(and(eq(employerRemittances.id, id), eq(employerRemittances.organizationId, organizationId)));

    if (!existing) throw ApiError.notFound('Remittance not found');

    const [updated] = await db
      .update(employerRemittances)
      .set({ ...body, updatedAt: new Date(), lastModifiedBy: userId ?? undefined })
      .where(eq(employerRemittances.id, id))
      .returning();

    logger.info('Employer remittance updated', { remittanceId: id, organizationId });

    return { data: updated };
  },
);
