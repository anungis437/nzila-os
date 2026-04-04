/**
 * Record Payment for Member in Arrears
 *
 * POST /api/dues/arrears/[id]/payment
 *
 * Body: { amount: number; notes?: string }
 *
 * Creates a payment ledger entry and updates the member's arrears record.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
import { memberArrears, memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Record a payment for a member in arrears' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const memberId = params.id;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');

    const { amount, notes } = parsed.data;

    // Fetch current arrears balance
    const [arrears] = await db
      .select()
      .from(memberArrears)
      .where(
        and(
          eq(memberArrears.userId, memberId),
          eq(memberArrears.organizationId, organizationId),
        ),
      );

    if (!arrears) throw ApiError.notFound('Arrears record not found');

    const balanceBefore = parseFloat(arrears.totalOwed ?? '0');
    const balanceAfter = Math.max(0, balanceBefore - amount);
    const newStatus = balanceAfter === 0 ? 'current' : arrears.arrearsStatus;

    // Record payment in ledger and update arrears
    const updated = await withRLSContext(async () => {
      await db.insert(memberDuesLedger).values({
        userId: memberId,
        organizationId,
        transactionType: 'payment',
        transactionDate: new Date(),
        effectiveDate: new Date(),
        amount: String(amount),
        balanceBefore: String(balanceBefore),
        balanceAfter: String(balanceAfter),
        description: notes ?? 'Arrears payment',
        notes,
        paymentMethod: 'manual',
        createdBy: userId ?? undefined,
      });

      // Update arrears record
      const [u] = await db
        .update(memberArrears)
        .set({
          totalOwed: String(balanceAfter),
          lastPaymentDate: new Date(),
          arrearsStatus: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(memberArrears.id, arrears.id))
        .returning();

      return u;
    });

    logger.info('Arrears payment recorded', { memberId, amount, balanceAfter });

    return { success: true, newBalance: balanceAfter, arrears: updated };
  },
);
