/**
  * GET /api/carbon/infrastructure
 *
 * Carbon accounting is not implemented. No emissions are measured or ingested, so this route returns no figures,
 * recommendations or certification outcome. It previously returned literal values with success true and status 200, which
 * presented invented measurements as monitoring results. Capability: UE-ACTION-CARBON-ACCOUNTING.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Carbon'],
      summary: 'Infrastructure carbon monitoring (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Infrastructure carbon monitoring is not implemented: no emissions are measured, so no regional figures are available.');
  },
);