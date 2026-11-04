/**
 * POST /api/cron/calendar-sync
 *
 * Not implemented, and not scheduled. External calendar synchronization is NOT_IMPLEMENTED (UE-ACTION-CALENDAR-SYNC in lib/reality/capability-registry.ts):
 * the provider OAuth callbacks create a connection with no calendar mapping and nothing creates a mapping, so every run could only answer "No calendar
 * mappings configured". The job selected connections across every organization and wrote their sync state and imported events as the system role, which holds no
 * privilege on those tables; it now reads and writes nothing and answers HTTP 501. Its schedule entry was removed from lib/operations/scheduled-jobs.json so no
 * run fails for it. A person's own sync (POST /api/calendar-sync/connections/[id]/sync) runs in that person's organization and is unchanged.
 */
import { withApi } from '@/lib/api/framework'
import { ApiError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron', 'Calendar'],
      summary: 'Calendar sync cron — NOT_IMPLEMENTED (returns HTTP 501)',
    },
  },
  async () => {
    throw ApiError.notImplemented(
      'The calendar sync cron is not implemented. Capability UE-ACTION-CALENDAR-SYNC is NOT_IMPLEMENTED: no calendar mapping exists for a connection. Nothing was read or written.',
    )
  },
)
