/**
 * Employer Remittance Item Route
 *
 * GET   /api/dues/remittances/:id — Retrieve a specific employer remittance
 * PATCH /api/dues/remittances/:id — Update remittance status/notes/reconciliation
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { buildUnionEvidencePack } from '@/lib/evidence';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Get an employer remittance by ID' },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const [remittance] = await withRLSContext({ organizationId }, async (tx) => {
      await requireLiveFinancialMandate(tx, organizationId);
      return tx
        .select()
        .from(employerRemittances)
        .where(and(eq(employerRemittances.id, id), eq(employerRemittances.organizationId, organizationId)));
    });

    if (!remittance) throw ApiError.notFound('Remittance not found');

    return { data: remittance };
  },
);

// Reconciliation, totals and result counters are outputs of a processing engine, never caller input.
// Unknown keys (isReconciled, reconciledAt/By, variance, expectedAmount, records*) are rejected.
const patchSchema = z
  .object({
    processingStatus: z.enum(['requires_review', 'failed']).optional(),
    notes: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const PATCH = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    openapi: { tags: ['Dues'], summary: 'Update an employer remittance' },
  },
  async ({ organizationId, userId, params, request }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const body = patchSchema.parse(await request.json());

    const updated = await withRLSContext({ organizationId }, async (tx) => {
      await requireLiveFinancialMandate(tx, organizationId);
      const [row] = await tx
        .update(employerRemittances)
        .set({ ...body, updatedAt: new Date(), lastModifiedBy: userId ?? undefined })
        .where(and(eq(employerRemittances.id, id), eq(employerRemittances.organizationId, organizationId)))
        .returning();
      if (!row) throw ApiError.notFound('Remittance not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId!,
        action: 'dues.remittance.update',
        resourceType: 'employer_remittances',
        resourceId: id,
        details: { fields: Object.keys(body) },
      });
      return row;
    });

    logger.info('Employer remittance updated', { remittanceId: id, organizationId });

    buildUnionEvidencePack({
      actionType: 'REMITTANCE_UPDATED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'remittance', data: { remittanceId: id, fields: Object.keys(body) } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'REMITTANCE_UPDATED' }));

    return { data: updated };
  },
);
