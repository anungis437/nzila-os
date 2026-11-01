/**
 * Cron: expire signature requests that have run out.
 *
 * A request that nobody tries to sign after its expiry date stayed "pending" until someone opened it: the status read said expired
 * without writing, so reports, reminders and the document list disagreed with the stored state. This job sets every internal,
 * still-open document past its expiry to expired, lapses its unsettled signers, and records the trail event and the platform audit
 * record in the same organization-scoped transaction as the change.
 *
 * Cron-authenticated. The overdue documents are found across organizations by system authority (a cross-organization SELECT on
 * signature_documents only); each change is made inside its own organization's context. A document that fails is reported and the
 * run is a visible failure; the rest are still expired. A document held by a signature provider is left to the provider sync.
 */
import { withApi } from '@/lib/api/framework';
import { jobResponse } from '@/lib/operations/job-result';
import { SignatureService } from '@/lib/signature/signature-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Expire signature requests past their expiry date' },
  },
  async () => {
    const report = await SignatureService.expireOverdue();
    return jobResponse({
      job: 'signature-expiry',
      attempted: report.scanned,
      succeeded: report.expired,
      failures: [
        ...report.failures.map((failure) => ({ scope: `signature-document:${failure.documentId}`, reason: failure.reason })),
        // A run that stopped at its page bound has not finished: the remainder is a visible failure, picked up by the next run.
        ...(report.truncated ? [{ scope: 'scan', reason: 'stopped at the page bound; remaining overdue documents are left for the next run' }] : []),
      ],
      details: { truncated: report.truncated },
    });
  },
);

export const POST = handler;
