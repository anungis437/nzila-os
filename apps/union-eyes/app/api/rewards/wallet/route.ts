import { NextRequest, NextResponse } from 'next/server';
import { getBalance, listLedger } from '@/lib/services/rewards/wallet-service';
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
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const balance = await getBalance(organizationId, userId);

    const ledgerResult = await listLedger(organizationId, userId, limit, offset);

    return NextResponse.json(
      {
        balance,
        ledger: {
          entries: ledgerResult.entries,
          pagination: {
            limit,
            offset,
            hasMore: ledgerResult.entries.length === limit,
          },
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

