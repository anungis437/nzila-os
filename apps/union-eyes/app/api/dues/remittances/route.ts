/**
 * Employer Remittances Collection Route
 *
 * GET  /api/dues/remittances — List employer remittances for the org
 * POST /api/dues/remittances — Create a new employer remittance record
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db';
import { employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['Dues'], summary: 'List employer remittances' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const rows = await db
      .select()
      .from(employerRemittances)
      .where(eq(employerRemittances.organizationId, organizationId))
      .orderBy(desc(employerRemittances.createdAt));

    return { data: rows };
  },
);

const createSchema = z.object({
  employerId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  fiscalYear: z.number().int(),
  fiscalMonth: z.number().int().min(1).max(12),
  remittanceDate: z.coerce.date(),
  totalAmount: z.string(),
  memberCount: z.number().int().min(0),
  remittanceNumber: z.string().optional(),
  fileName: z.string().optional(),
  fileUrl: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Dues'], summary: 'Create an employer remittance' },
  },
  async ({ organizationId, userId, request }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = createSchema.parse(await request.json());

    const [remittance] = await db
      .insert(employerRemittances)
      .values({
        ...body,
        organizationId,
        createdBy: userId ?? undefined,
      })
      .returning();

    logger.info('Employer remittance created', { remittanceId: remittance.id, organizationId });

    return { data: remittance };
  },
);
