import { NextRequest, NextResponse } from 'next/server';
import {
  cancelRedemption,
  listUserRedemptions,
} from '@/lib/services/rewards/redemption-service';
import { initiateRedemptionSchema } from '@/lib/validation/rewards-schemas';
import { z } from 'zod';
import { withRoleAuth } from '@/lib/api-auth-guard';

 
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

    const validStatuses = ['pending', 'ordered', 'fulfilled', 'cancelled', 'refunded'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await listUserRedemptions(
      organizationId,
      userId,
      limit,
      offset
    );

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

    const body = await request.json();

    let _validatedData;
    try {
      _validatedData = initiateRedemptionSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          error
        );
      }
      throw error;
    }

    const { searchParams } = new URL(request.url);
    const redemptionId = searchParams.get('id');

    if (!redemptionId) {
      return standardErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Redemption ID required'
      );
    }

    // A member cancels only their own redemption; the credits go back to the member who spent them.
    const cancelledRedemption = await cancelRedemption(
      redemptionId,
      organizationId,
      'member_cancelled',
      { userId, mustOwn: true }
    );

    return standardSuccessResponse({
      redemption: cancelledRedemption,
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

