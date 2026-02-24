/**
 * GET /api/onboarding/smart-defaults
 * Migrated to withApi() framework
 */
import { getSmartDefaults } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Onboarding'],
      summary: 'GET smart-defaults',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const { searchParams } = new URL(request.url);
        const organizationType = searchParams.get('organizationType') || 'local';
        const memberCountStr = searchParams.get('memberCount');
        const memberCount = memberCountStr ? parseInt(memberCountStr, 10) : undefined;
        const defaults = getSmartDefaults(organizationType, memberCount);
        logger.info('Smart defaults generated', { 
          userId,
          organizationType,
          memberCount,
        });
        return { defaults,
          metadata: {
            organizationType,
            memberCount: memberCount || 'not specified',
          }, };
  },
);
