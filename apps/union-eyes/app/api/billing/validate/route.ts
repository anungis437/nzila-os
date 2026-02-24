import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  convertUSDToCAD,
  checkT106Requirement,
  validateBillingRequest,
} from '@/lib/services/transfer-pricing-service';
import type { BillingValidationResponse } from '@/lib/types/compliance-api-types';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { withRoleAuth } from '@/lib/api-auth-guard';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * Billing Validation API
 * Enforces CAD-only billing per CRA transfer pricing rules
 * Validates T1 General / T106 slip requirements
 */

// Validation schema for billing validation
const billingValidationSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  invoiceDate: z.string().optional(),
});

/**
 * POST /api/billing/validate
 * Validate billing request for CAD currency compliance and T106 requirements
 */
export const POST = withRoleAuth('steward', async (request, context) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body'
    );
  }

  const parsed = billingValidationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      parsed.error
    );
  }

  const body = parsed.data;
  const { userId, organizationId: _organizationId } = context as { userId: string; organizationId: string };

    const orgId = (body as Record<string, unknown>)["organizationId"] ?? (body as Record<string, unknown>)["orgId"] ?? (body as Record<string, unknown>)["organization_id"] ?? (body as Record<string, unknown>)["org_id"] ?? (body as Record<string, unknown>)["unionId"] ?? (body as Record<string, unknown>)["union_id"] ?? (body as Record<string, unknown>)["localId"] ?? (body as Record<string, unknown>)["local_id"];
  if (typeof orgId === 'string' && orgId.length > 0 && orgId !== context.organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {
      const { amount, currency, invoiceDate } = body;

      // Validate billing request
      const validation = await validateBillingRequest({
        invoiceId: `inv-${Date.now()}`,
        amount,
        currency,
        date: invoiceDate ? new Date(invoiceDate) : new Date(),
      });

      if (!validation.valid) {
        // If not CAD, attempt conversion
        if (currency !== 'CAD') {
          try {
            const convertedAmount = await convertUSDToCAD(amount, new Date());
            
            logApiAuditEvent({
              timestamp: new Date().toISOString(), userId,
              endpoint: '/api/billing/validate',
              method: 'POST',
              eventType: 'success',
              severity: 'medium',
              details: {
                dataType: 'FINANCIAL',
                originalCurrency: currency,
                originalAmount: amount,
                convertedAmount,
                requiresConversion: true,
              },
            });

            return NextResponse.json({
              valid: false,
              currency: 'CAD',
              amount: convertedAmount,
              message: `Currency must be CAD. ${currency} ${amount} = CAD ${convertedAmount.toFixed(2)}`,
              error: validation.error,
            } as BillingValidationResponse);
          } catch (conversionError) {
            logApiAuditEvent({
              timestamp: new Date().toISOString(), userId,
              endpoint: '/api/billing/validate',
              method: 'POST',
              eventType: 'unauthorized_access',
              severity: 'high',
              details: { 
                error: `Currency conversion failed: ${conversionError}`,
                currency,
                amount,
              },
            });

            return NextResponse.json(
              {
                valid: false,
                currency: 'CAD',
                error: `Currency conversion failed: ${conversionError}`,
                requiredCurrency: 'CAD',
              },
              { status: 400 }
            );
          }
        }

        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/billing/validate',
          method: 'POST',
          eventType: 'auth_failed',
          severity: 'medium',
          details: { reason: validation.error, currency, amount },
        });

        return NextResponse.json(
          {
            valid: false,
            currency: 'CAD',
            error: validation.error,
            requiredCurrency: 'CAD',
          },
          { status: 400 }
        );
      }

      // Check T106 requirements
      const t106Check = await checkT106Requirement(amount, true);

      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/billing/validate',
        method: 'POST',
        eventType: 'success',
        severity: 'medium',
        details: {
          dataType: 'FINANCIAL',
          amount,
          currency,
          requiresT106: t106Check.requiresT106,
        },
      });

      return NextResponse.json({
        valid: true,
        currency: 'CAD',
        amount,
        message: 'Billing request approved',
        requiresT106: t106Check.requiresT106,
        t106Notes: t106Check.reason,
      } as BillingValidationResponse);
    } catch (error) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/billing/validate',
        method: 'POST',
        eventType: 'unauthorized_access',
        severity: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });

      return NextResponse.json(
        {
          valid: false,
          error: `Billing validation failed: ${error}`,
          currency: 'CAD',
        },
        { status: 500 }
      );
    }
});

