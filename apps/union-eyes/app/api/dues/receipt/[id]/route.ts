/**
 * Payment Receipt Route (Read-Only)
 *
 * GET /api/dues/receipt/:id — Retrieve a specific dues ledger entry
 * (receipt) belonging to the authenticated member. Backed by the native
 * member_dues_ledger table.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Dues'], summary: "Get a member's dues payment receipt by ledger entry ID" },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization/user context required');
    const { id } = await params;

    const [entry] = await db
      .select()
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.id, id),
          eq(memberDuesLedger.organizationId, organizationId),
          eq(memberDuesLedger.userId, userId),
        ),
      );

    if (!entry) throw ApiError.notFound('Dues payment receipt');

    return { data: entry };
  },
);
