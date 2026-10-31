/**
 * CRUD item route for arbitrations
 *
 * Changing an arbitration re-checks the case authority against the row loaded under the update's own lock; the grievance it belongs
 * to cannot be changed through this route.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { mayWriteArbitrationFor } from '@/lib/arbitration/arbitration-case-authority';
import { arbitrations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
  blockedPatchFields: ['grievanceId'],
  lockedAuthCheck: async (existing, { organizationId, userId }) => {
    if (!organizationId || !userId || typeof existing.grievanceId !== 'string') return { ok: false, status: 403 };
    return (await mayWriteArbitrationFor({ organizationId, grievanceId: existing.grievanceId, userId })) ? { ok: true } : { ok: false, status: 403 };
  },
});
export { GET, PATCH, DELETE };
