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
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
        redemptions: result.redemptions,
        pagination: {
          limit,
          offset,
          hasMore: result.redemptions.length === limit,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
  }
});

export const POST = withRoleAuth('member', async (request: NextRequest, context) => {
  try {
    const { userId: _userId, organizationId } = context as { userId: string; organizationId: string };

    if (!organizationId) {
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

    const cancelledRedemption = await cancelRedemption(
      redemptionId,
      organizationId,
      'member_cancelled'
    );

    return standardSuccessResponse({
      redemption: cancelledRedemption,
      message: 'Redemption cancelled and credits refunded',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Cannot cancel')) {
      return NextResponse.json(
        { error: errorMessage },
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

