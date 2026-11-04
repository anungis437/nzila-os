import { NextResponse } from 'next/server';
import { getWalletSnapshot } from '@/lib/services/rewards/wallet-service';
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// The wallet is read in the member's tenant transaction (`rlsOrgContext`): row-level security shows the member's own organization's ledger.
export const GET = withApi(
  {
    auth: { minRole: 'member' },
    rlsOrgContext: true,
    openapi: { tags: ['Rewards'], summary: 'Read the reward wallet balance and ledger of the caller' },
  },
  async ({ request, userId, organizationId }) => {
  try {
    const { searchParams } = new URL(request.url);
    // A non-numeric or negative value is the default, never NaN or a negative offset handed to the query.
    const boundedInt = (raw: string | null, fallback: number, min: number, max: number) => {
      const parsed = Number.parseInt(raw ?? '', 10);
      return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
    };
    const limit = boundedInt(searchParams.get('limit'), 20, 1, 100);
    const offset = boundedInt(searchParams.get('offset'), 0, 0, 1_000_000);

    // The balance and the page come from one snapshot, so they cannot disagree.
    const { balance, entries, total } = await getWalletSnapshot(organizationId!, userId!, limit, offset);

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
  } catch (error: unknown) {
    logger.error('Failed to read the reward wallet', { error });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
  }
  },
);
