import { NextRequest, NextResponse } from 'next/server';
import { getWalletSnapshot } from '@/lib/services/rewards/wallet-service';
import { withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
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
    // A non-numeric or negative value is the default, never NaN or a negative offset handed to the query.
    const boundedInt = (raw: string | null, fallback: number, min: number, max: number) => {
      const parsed = Number.parseInt(raw ?? '', 10);
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
    };
    const limit = boundedInt(searchParams.get('limit'), 20, 1, 100);
    const offset = boundedInt(searchParams.get('offset'), 0, 0, 1_000_000);

    // The balance and the page come from one snapshot, so they cannot disagree.
    const { balance, entries, total } = await getWalletSnapshot(organizationId, userId, limit, offset);

    return NextResponse.json(
      {
        balance,
        ledger: {
          entries,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + entries.length < total,
          },
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

