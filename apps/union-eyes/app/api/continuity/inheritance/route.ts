/**
 * Continuity/inheritance alias for the pending-profiles onboarding route.
 * Inlines crudRoutes() (rather than re-exporting) so contract scanners see
 * the auth+org-scope guard directly in this file.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pendingProfilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pendingProfilesTable,
  pk: 'id',
  tags: ['Auth'],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
