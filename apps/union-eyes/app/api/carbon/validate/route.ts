/**
  * POST /api/carbon/validate
 *
 * Carbon accounting is not implemented. No emissions are measured or ingested, so this route returns no figures,
 * recommendations or certification outcome. It previously returned literal values with success true and status 200, which
 * presented invented measurements as monitoring results. Capability: UE-ACTION-CARBON-ACCOUNTING.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Carbon'],
      summary: 'Carbon claim validation (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Carbon claim validation is not implemented: no claim was assessed and no certification outcome is given.');
  },
);