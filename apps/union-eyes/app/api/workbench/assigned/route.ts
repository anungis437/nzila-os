/**
 * GET /api/workbench/assigned
 * Returns claims from the database for the LRO workbench case queue.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { loadWorkbenchCases } from '@/lib/cases/workbench-queue';
import { workbenchCapabilities } from '@/lib/cases/workbench-projection';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    canonicalRequestScope: true,
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench'],
      summary: 'GET assigned cases',
      description:
        'Returns the actor-scoped case queue. Organization and role are derived server-side; ' +
        'matters without case-resource authority are reduced to triage metadata.',
    },
  },
  async ({ request }) => {
    const actor = await getCaseActor();
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get('organizationId');
    const status = url.searchParams.get('status');

    // The query string is a hint, never authority.
    if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
      throw ApiError.forbidden('Organization scope is not permitted for this actor.');
    }

    const rows = await withRLSContext(tx => loadWorkbenchCases(tx, actor, status));

    return {
      claims: rows,
      capabilities: workbenchCapabilities(rows),
    };
  },
);

