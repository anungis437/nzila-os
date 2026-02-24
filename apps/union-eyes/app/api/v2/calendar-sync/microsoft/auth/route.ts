import { NextResponse } from 'next/server';
/**
 * GET /api/calendar-sync/microsoft/auth
 * Migrated to withApi() framework
 */
import { getAuthorizationUrl } from '@/lib/external-calendar-sync/microsoft-calendar-service';
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Calendar-sync'],
      summary: 'GET auth',
    },
  },
  async ({ request: _request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          if (!userId) {
            throw ApiError.unauthorized('Authentication required');
          }
          // Generate authorization URL with userId as state
          const authUrl = await getAuthorizationUrl(userId);
          // Redirect to Microsoft authorization page
          return NextResponse.redirect(authUrl);
  },
);
