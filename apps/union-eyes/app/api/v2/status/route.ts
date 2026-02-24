/**
 * GET /api/status
 * Migrated to withApi() framework
 */
import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/monitoring/status-page';
 
 
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Status'],
      summary: 'GET status',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        const status = await getSystemStatus();
        // Return 503 if system is down
        const statusCode = status.status === 'down' ? 503 : 200;
        return NextResponse.json(status, { status: statusCode });
  },
);
