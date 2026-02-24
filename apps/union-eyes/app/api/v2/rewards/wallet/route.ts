/**
 * GET /api/rewards/wallet
 * Migrated to withApi() framework
 */
import { NextResponse } from 'next/server';
import { getBalance, listLedger } from '@/lib/services/rewards/wallet-service';
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Rewards'],
      summary: 'GET wallet',
    },
  },
  async ({ request, userId, organizationId, user: _user, body: _body, query: _query }) => {

          if (!organizationId) {
            throw ApiError.internal('Organization context required');
          }
          if (!userId) {
            throw ApiError.unauthorized('Authentication required');
          }
          // 2. Parse query parameters
          const { searchParams } = new URL(request.url);
          const limit = Math.min(
            parseInt(searchParams.get('limit') || '20', 10),
            100
          );
          const offset = parseInt(searchParams.get('offset') || '0', 10);
          // 3. Get wallet balance
          const balance = await getBalance(organizationId, userId);
          // 4. Get recent ledger entries
          const ledger = await listLedger(organizationId, userId, limit, offset);
          // 5. Return response
          return NextResponse.json(
            {
              balance,
              ledger: {
                entries: ledger.entries,
                pagination: {
                  limit,
                  offset,
                  hasMore: ledger.entries.length === limit,
                },
              },
            },
            { status: 200 }
          );
  },
);
