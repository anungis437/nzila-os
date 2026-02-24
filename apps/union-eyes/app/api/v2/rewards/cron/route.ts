/**
 * GET POST /api/rewards/cron
 * Migrated to withApi() framework
 */
import { db } from '@/db';
import { processAnniversaryAwards, processScheduledAwards } from '@/lib/services/rewards/automation-service';
 
 
import { sendBatchExpirationWarnings } from '@/lib/services/rewards/notification-service';

import { timingSafeEqual } from 'crypto';

 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Rewards'],
      summary: 'GET cron',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Rewards'],
      summary: 'POST cron',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        // 1. Verify cron secret (timing-safe comparison)
        const authHeader = request.headers.get('authorization');
        const secret = authHeader?.replace('Bearer ', '') ?? '';
        const expected = process.env.CRON_SECRET ?? '';
        const secretBuf = Buffer.from(secret);
        const expectedBuf = Buffer.from(expected);
        if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        // 2. Get task parameter
        const searchParams = request.nextUrl.searchParams;
        const task = searchParams.get('task') || 'all';
        const results = {
          timestamp: new Date().toISOString(),
          task,
          executed: [] as Record<string, unknown>[],
        };
        // 3. Get all organizations
        const organizations = await db.query.organizations.findMany({
          where: (orgs, { eq }) => eq(orgs.status, 'active'),
        });
        // 4. Process tasks
        if (task === 'anniversaries' || task === 'all') {
    const anniversaryResults = await Promise.allSettled(
            organizations.map((org) => processAnniversaryAwards(org.id))
          );
          results.executed.push({
            task: 'anniversaries',
            organizations: organizations.length,
            results: anniversaryResults.map((r, i) => ({
              orgId: organizations[i].id,
              status: r.status,
              data: r.status === 'fulfilled' ? r.value : undefined,
              error: r.status === 'rejected' ? r.reason : undefined,
            })),
          });
        }
        if (task === 'expirations' || task === 'all') {
    const expirationResult = await sendBatchExpirationWarnings();
          results.executed.push({
            task: 'expirations',
            result: expirationResult,
          });
        }
        if (task === 'scheduled' || task === 'all') {
    const scheduledResults = await Promise.allSettled(
            organizations.map((org) => processScheduledAwards(org.id))
          );
          results.executed.push({
            task: 'scheduled',
            organizations: organizations.length,
            results: scheduledResults.map((r, i) => ({
              orgId: organizations[i].id,
              status: r.status,
              data: r.status === 'fulfilled' ? r.value : undefined,
              error: r.status === 'rejected' ? r.reason : undefined,
            })),
          });
        }
    return { data: results, };
  },
);
