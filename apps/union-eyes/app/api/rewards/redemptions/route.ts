import { NextRequest, NextResponse } from 'next/server';
import {
  cancelRedemption,
  listUserRedemptions,
} from '@/lib/services/rewards/redemption-service';
import { cancelRedemptionSchema } from '@/lib/validation/rewards-schemas';
import { z } from 'zod';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';

 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request: NextRequest, context) => {
  try {
    const { userId, organizationId } = context as { userId: string; organizationId: string };

    if (!organizationId) {
      return standardErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Organization context required'
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    // A non-numeric or negative value is the default, never NaN or a negative offset handed to the query.
    const boundedInt = (raw: string | null, fallback: number, min: number, max: number) => {
      const parsed = Number.parseInt(raw ?? '', 10);
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
    };
    const limit = boundedInt(searchParams.get('limit'), 20, 1, 100);
    const offset = boundedInt(searchParams.get('offset'), 0, 0, 1_000_000);

    // The values the redemption status can hold; an earlier list named one it never holds and omitted the ones a redemption starts in.
    const validStatuses = ['initiated', 'pending_payment', 'ordered', 'fulfilled', 'cancelled', 'refunded'] as const;
    if (status && !(validStatuses as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Tenant-bound execution, not merely an explicit organization predicate.
    const result = await withRLSContext({ organizationId }, () => listUserRedemptions(
      organizationId,
      userId,
      limit,
      offset,
      status as (typeof validStatuses)[number] | undefined
    ));

    return NextResponse.json(
      {
        // The provider's order payload and checkout identifiers are the processor's record, not the member's: they are not returned.
        redemptions: result.redemptions.map(({ providerPayloadJson: _payload, providerCheckoutId: _checkout, ...redemption }) => redemption),
        pagination: {
          limit,
          offset,
          hasMore: result.redemptions.length === limit,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
  }
});

export const POST = withRoleAuth('member', async (request: NextRequest, context) => {
  try {
    const { userId, organizationId } = context as { userId: string; organizationId: string };

    if (!organizationId || !userId) {
      return standardErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Organization context required'
      );
    }

    // This path cancels a redemption, so it validates a cancellation: an initiation body (program, credits) is rejected rather than parsed and discarded.
    let validated;
    try {
      const body = await request.json();
      validated = cancelRedemptionSchema
        .extend({ reason: z.string().trim().min(1).max(200) })
        .strict()
        .parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          error
        );
      }
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be a JSON cancellation');
    }

    const redemptionId = validated.redemptionId;

    // A member cancels only their own redemption; the credits go back to the member who spent them.
    const cancelledRedemption = await withRLSContext({ organizationId }, () => cancelRedemption(
      redemptionId,
      organizationId,
      `member_cancelled: ${validated.reason}`,
      { userId, mustOwn: true }
    ));

    // A member receipt must never echo the payment provider's payload or identifiers.
    const { redemption, newBalance } = cancelledRedemption;
    return standardSuccessResponse({
      redemption: { id: redemption.id, status: redemption.status, creditsSpent: redemption.creditsSpent, updatedAt: redemption.updatedAt },
      newBalance,
      message: 'Redemption cancelled and credits refunded',
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Cannot cancel')) {
      return NextResponse.json(
        { error: 'Cannot cancel this redemption' },
        { status: 400 }
      );
    }

    if (errorMessage.includes('not found')) {
      return standardErrorResponse(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Redemption not found',
        error
      );
    }

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
  }
});

