/**
 * Financial duties on one payment (UE-CONV-D-001 / D-002).
 *
 * GET  /api/payments/[id]/duties  — the transaction as the kernel `finance:view` duty shows it
 * POST /api/payments/[id]/duties  — Body: { step: 'registered' | 'prepared' | 'approved' | 'reconciled', ... }
 *
 * `registered` snapshots the payment's amount and currency into the kernel financial workflow for an account (it needs
 * the prepare duty on that account) with the number of independent approvals the institution requires. `prepared`,
 * `approved` and `reconciled` are the prepare, approve and reconcile duties. EVERY step is a kernel decision on this
 * transaction: a live financial mandate naming the account and the duty, a financial capacity, and segregation of
 * duties against the transaction's real participants. Role level is never an input.
 *
 * `executed` is deliberately not available here: executing is the money movement itself and happens only in the route
 * that moves the money (POST /api/dues/arrears/[id]/payment), so no one can mark a payment executed without posting it.
 */
import { NextResponse } from 'next/server';
import { withApi, ApiError, RATE_LIMITS, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { performFinancialDuty, readFinancialTransaction } from '@/lib/authority/store/finance-route-adapter';
import { financialDutyErrorResponse } from '@/lib/finance/financial-duty-response';

export const dynamic = 'force-dynamic';

const stepSchema = z
  .object({
    step: z.enum(['registered', 'prepared', 'approved', 'executed', 'reconciled']),
    accountId: z.string().uuid().optional(),
    requiredApprovals: z.number().int().min(1).max(10).optional(),
  })
  .strict();

const AUDIT_ACTION = {
  registered: 'finance.payment.register',
  prepared: 'finance.payment.prepare',
  approved: 'finance.payment.approve',
  reconciled: 'finance.payment.reconcile',
} as const;

export const GET = withApi(
  {
    auth: { required: true },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Payments'], summary: 'Read a payment in the financial workflow' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    try {
      const data = await withRLSContext({ organizationId }, (tx) =>
        readFinancialTransaction(tx, { userId, organizationId, transactionId: params.id }),
      );
      return { data };
    } catch (error) {
      const refusal = financialDutyErrorResponse(error);
      if (refusal) return refusal;
      throw error;
    }
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: 'financial_intelligence_suite',
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: { tags: ['Payments'], summary: 'Register, prepare, approve or reconcile a payment' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const parsed = stepSchema.safeParse(await request.json());
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');
    const { step, accountId, requiredApprovals } = parsed.data;

    if (step === 'executed') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'STEP_NOT_AVAILABLE',
            message: 'A payment is executed only by the route that moves the money (POST /api/dues/arrears/{member}/payment).',
          },
        },
        { status: 422 },
      );
    }
    const registering = step === 'registered';
    const hasRegistrationFields = accountId !== undefined && requiredApprovals !== undefined;
    const hasAnyRegistrationField = accountId !== undefined || requiredApprovals !== undefined;
    if (registering ? !hasRegistrationFields : hasAnyRegistrationField) {
      throw ApiError.badRequest('accountId and requiredApprovals are required to register a payment, and only then');
    }

    try {
      const { stepId } = await withRLSContext({ organizationId }, (tx) =>
        performFinancialDuty(
          tx,
          { userId, organizationId, transactionId: params.id, step, accountId, requiredApprovals },
          undefined,
          {
            action: AUDIT_ACTION[step],
            resourceType: 'payments',
            resourceId: params.id,
            details: registering ? { accountId, requiredApprovals } : {},
          },
        ),
      );
      return { success: true, data: { transactionId: params.id, step, stepId } };
    } catch (error) {
      const refusal = financialDutyErrorResponse(error);
      if (refusal) return refusal;
      throw error;
    }
  },
);
