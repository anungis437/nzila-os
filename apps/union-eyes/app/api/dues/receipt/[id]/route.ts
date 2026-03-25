/**
 * Payment Receipt Route (Read-Only)
 *
 * GET /api/dues/receipt/:id — Retrieve a specific payment receipt
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { platformPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['Dues'], summary: 'Get a payment receipt by ID' },
  },
  async ({ organizationId, params }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    const [payment] = await db
      .select()
      .from(platformPayments)
      .where(and(eq(platformPayments.id, id), eq(platformPayments.organizationId, organizationId)));

    if (!payment) throw ApiError.notFound('Payment receipt not found');

    return { data: payment };
  },
);
