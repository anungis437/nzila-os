/**
 * Post a Payment to a Member's Arrears
 *
 * POST /api/dues/arrears/[id]/payment
 *
 * Body: { paymentId: uuid; amount: number; notes?: string }
 *
 * Authority is a kernel decision (UE-CONV-D-001), not a role: posting a received payment to the member's dues ledger is
 * the `execute` duty of the registered payment `paymentId`. The caller must hold a live `financial` mandate naming the
 * payment's account and the execute duty, must be independent of whoever prepared and approved it, and the amount
 * claimed must equal the amount on record. The financial step, ledger entry, arrears update and audit record are one
 * transaction. See lib/authority/store/finance-route-adapter.ts for the answers (404 / 403 / 409 / 501).
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { recordArrearsPayment } from '@/lib/dues/arrears-payment';
import { financialDutyErrorResponse } from '@/lib/finance/financial-duty-response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const schema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Execute a registered payment against a member in arrears' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const memberId = params.id;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');

    const { paymentId, amount, notes } = parsed.data;

    let outcome;
    try {
      outcome = await withRLSContext({ organizationId }, (tx) =>
        recordArrearsPayment(tx, { userId, organizationId, memberId, paymentId, amount, notes }),
      );
    } catch (error) {
      const refusal = financialDutyErrorResponse(error);
      if (refusal) return refusal;
      throw error;
    }

    logger.info('Arrears payment recorded', { memberId, paymentId, amount, balanceAfter: outcome.balanceAfter });

    return { success: true, newBalance: outcome.balanceAfter, arrears: outcome.arrears };
  },
);
