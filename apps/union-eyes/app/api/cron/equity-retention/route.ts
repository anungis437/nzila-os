import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { enforceEquityRetention } from '@/lib/equity/retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withApi(
  { auth: { cron: true }, openapi: { tags: ['Cron'], summary: 'Erase expired equity self-identification payloads' } },
  async () => withSystemContext((tx) => enforceEquityRetention(tx)),
);
