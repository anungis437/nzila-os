/**
 * Cron: expire lapsed document intakes and delete the objects of cancelled and expired ones.
 * Cron-authenticated. Each state change is audited under the system reaper actor; a storage failure is recorded on the
 * intake row and retried, and never marks an object deleted.
 */
import { withApi } from '@/lib/api/framework';
import { jobResponse } from '@/lib/operations/job-result';
import { runIntakeReaper } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Expire lapsed document intakes and delete abandoned objects' },
  },
  async () => {
    const report = await runIntakeReaper(blobIntakeStorage);
    // An object past its retry limit is a visible failed run, not a silent leftover.
    return jobResponse({
      job: 'document-intake-reaper',
      attempted: report.objectsDeleted + report.deletionFailed + report.abandoned,
      succeeded: report.objectsDeleted,
      failures: report.abandoned > 0 ? [{ scope: 'abandoned-objects', reason: `${report.abandoned} object(s) past the deletion retry limit` }] : [],
      details: { ...report },
    });
  },
);

export const POST = handler;
