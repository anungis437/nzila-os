import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  convertUSDToCAD,
  checkT106Requirement,
  validateBillingRequest,
} from '@/lib/services/transfer-pricing-service';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * Validate proposed billing terms, without authorizing or posting an invoice.
 * Ordinary validation failures are NOT authentication/security incidents.
 * Every evaluated result has a durable tenant-bound audit receipt.
 */
const billingValidationSchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code'),
  invoiceDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid invoice date').optional(),
}).strict();

type Actor = { userId: string; organizationId: string };

async function recordValidation(
  actor: Actor,
  action: 'billing.validation.accepted' | 'billing.validation.rejected' | 'billing.validation.unavailable',
  details: Record<string, unknown>,
  outcome: 'success' | 'failure',
): Promise<void> {
  await withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await persistAtomicAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      action,
      resourceType: 'billing_validation',
      details,
    }, outcome);
  });
}

/** Never return a successful validation result unless its audit row committed. */
async function auditedResult(
  actor: Actor,
  payload: Record<string, unknown>,
  status: number,
  action: 'billing.validation.accepted' | 'billing.validation.rejected' | 'billing.validation.unavailable',
  details: Record<string, unknown>,
): Promise<NextResponse> {
  try {
    await recordValidation(actor, action, details, action === 'billing.validation.accepted' ? 'success' : 'failure');
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Billing validation temporarily unavailable' },
      { status: 503 },
    );
  }
  return NextResponse.json(payload, { status });
}

export const POST = withRoleAuth('steward', async (request, context) => {
  const actor: Actor = {
    userId: context.userId as string,
    organizationId: context.organizationId as string,
  };
  if (!actor.userId || !actor.organizationId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Authenticated organization required');
  }
  try {
    await requireEntitlement(actor.organizationId, 'financial_intelligence_suite', actor.userId);
  } catch {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Entitlement required');
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return auditedResult(actor,
      { valid: false, error: 'Invalid JSON in request body' }, 400,
      'billing.validation.rejected', { reason: 'invalid_json' });
  }

  const parsed = billingValidationSchema.safeParse(input);
  if (!parsed.success) {
    return auditedResult(actor,
      { valid: false, error: 'Invalid request body' }, 400,
      'billing.validation.rejected', { reason: 'invalid_body' });
  }

  const { amount, currency, invoiceDate } = parsed.data;
  const detail = { currency, amount, invoiceDate: invoiceDate ?? null };

  try {
    const validation = await validateBillingRequest({
      invoiceId: `validation-${Date.now()}`,
      amount,
      currency,
      date: invoiceDate ? new Date(invoiceDate) : new Date(),
    });

    if (!validation.valid) {
      if (currency === 'USD') {
        try {
          const convertedAmount = await convertUSDToCAD(amount, invoiceDate ? new Date(invoiceDate) : new Date());
          return auditedResult(actor, {
            valid: false,
            currency: 'CAD',
            amount: convertedAmount,
            message: 'Billing requires CAD; this is an indicative conversion, not an approved invoice',
            error: validation.error,
          }, 200, 'billing.validation.rejected',
          { ...detail, reason: 'requires_CAD_conversion', convertedAmount });
        } catch {
          return auditedResult(actor, {
            valid: false,
            error: 'Currency conversion temporarily unavailable',
            requiredCurrency: 'CAD',
          }, 503, 'billing.validation.unavailable',
          { ...detail, reason: 'conversion_unavailable' });
        }
      }
      return auditedResult(actor, {
        valid: false,
        currency: 'CAD',
        error: validation.error ?? 'Billing validation failed',
        requiredCurrency: 'CAD',
      }, 400, 'billing.validation.rejected',
      { ...detail, reason: 'invalid_billing_terms' });
    }

    const t106Check = await checkT106Requirement(amount, true);
    return auditedResult(actor, {
      valid: true,
      currency: 'CAD',
      amount,
      message: 'Billing request validated; no invoice has been approved or posted',
      requiresT106: t106Check.requiresT106,
      t106Notes: t106Check.reason,
    }, 200, 'billing.validation.accepted',
    { ...detail, requiresT106: t106Check.requiresT106 });
  } catch {
    return auditedResult(actor, {
      valid: false,
      error: 'Billing validation temporarily unavailable',
    }, 503, 'billing.validation.unavailable',
    { ...detail, reason: 'validation_dependency_unavailable' });
  }
});
