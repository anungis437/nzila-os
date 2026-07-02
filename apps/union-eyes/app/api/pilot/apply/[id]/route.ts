/**
 * CRUD item route for pilot applications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';
import { withPilotOwnership } from '@/lib/pilot/pilot-ownership';

export const dynamic = 'force-dynamic';

// The pilot_applications table has no organization_id column, so the shared
// crud factory runs with orgScoped:false and cannot enforce ownership itself.
// Wrap each handler with withPilotOwnership, which loads the pilot by id,
// returns 404 if missing, and enforces the org-ownership invariant before the
// factory handler reads or mutates the record.
const handlers = crudRoutes({
  table: pilotApplications,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});

export const GET = withPilotOwnership(handlers.GET);
export const PATCH = withPilotOwnership(handlers.PATCH);
export const DELETE = withPilotOwnership(handlers.DELETE);

