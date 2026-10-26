/**
 * Cron: expire lapsed document intakes and delete the objects of cancelled and expired ones.
 * Cron-authenticated. Each state change is audited under the system reaper actor; a storage failure is recorded on the
 * intake row and retried, and never marks an object deleted.
 */
import { withApi } from '@/lib/api/framework';
import { runIntakeReaper } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Expire lapsed document intakes and delete abandoned objects' },
  },
  async () => ({ ...(await runIntakeReaper(blobIntakeStorage)) }),
);

export const GET = handler;
export const POST = handler;
