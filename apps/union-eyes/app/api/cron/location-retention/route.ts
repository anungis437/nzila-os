/**
 * Cron: enforce the 24-hour retention of member location data.
 * Cron-authenticated. Runs under the system role because retention covers every member's rows, which a user-scoped
 * session cannot see. Expired tracking points and geofence events are deleted with their deletion-log evidence in one
 * transaction, so a failed evidence write leaves the data in place for the next run.
 */
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { GeofencePrivacyService } from '@/services/geofence-privacy-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Delete expired member location data (24-hour retention)' },
  },
  async () => ({
    ...(await withSystemContext((tx) => GeofencePrivacyService.deleteExpiredLocationData(tx))),
  }),
);

export const GET = handler;
export const POST = handler;
