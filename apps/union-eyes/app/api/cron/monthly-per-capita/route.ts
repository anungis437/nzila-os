/**
 * POST /api/cron/monthly-per-capita
 *
 * Not implemented, and not scheduled. The affiliate (per-capita) remittance capability is NOT_IMPLEMENTED (UE-FIN-AFFILIATE-REMITTANCES in
 * lib/reality/capability-registry.ts: it needs a qualified model with institutional recipients, payable/receivable recognition and
 * acknowledgment), yet this job inserted and recalculated per_capita_remittances rows and marked them overdue for every organization
 * with a parent, which are financial records nothing qualified. It now writes nothing and answers HTTP 501 to an administrator;
 * the schedule entry was removed from lib/operations/scheduled-jobs.json so no monthly run fails for it.
 */

import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Cron'], summary: 'Monthly per-capita remittances (not implemented)' },
  },
  async () => {
    throw ApiError.notImplemented('Monthly per-capita remittance calculation is not implemented: the affiliate remittance model has not been qualified. Nothing was calculated or written.');
  },
);
