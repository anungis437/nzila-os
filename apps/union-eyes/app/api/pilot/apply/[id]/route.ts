/**
 * CRUD item route for pilot applications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';
import { preserveServerOwnedResponsesFields, withPilotOwnership } from '@/lib/pilot/pilot-ownership';

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
  // PR #752 round 21: verifiedOrganizationId/verifiedBy/verifiedAt are
  // server-controlled — the ONLY legitimate writer is bindPilotOrganization()
  // via POST .../verify-organization or .../rebind-organization (both
  // system_admin+). A same-org steward's generic PATCH must never be able to
  // set, clear, or alter them. status/reviewedAt/approvedAt are likewise
  // FSM-governed exclusively by commercial-transition (system_admin+) — not
  // arbitrary steward-editable fields.
  blockedPatchFields: [
    'verifiedOrganizationId',
    'verifiedBy',
    'verifiedAt',
    'status',
    'reviewedAt',
    'approvedAt',
  ],
  // PR #752 round 22/23: responses holds both the CLAIMED owning
  // organization and commercial-transition's authoritative FSM/scoring
  // state — nested JSONB subfields blockedPatchFields (flat top-level
  // keys) can't protect. See preserveServerOwnedResponsesFields's doc
  // comment in lib/pilot/pilot-ownership.ts for the full key list/rationale.
  beforeUpdate: (updates, { existing }) => preserveServerOwnedResponsesFields(updates, existing),
});

export const GET = withPilotOwnership(handlers.GET, { minRole: 'steward' });
export const PATCH = withPilotOwnership(handlers.PATCH, { minRole: 'steward' });

// PR #752 round 22: no DELETE export. The shared factory's generic DELETE
// soft-deletes by writing status = 'archived' whenever a `status` column
// exists — but round 21 made pilot `status` exclusively FSM-governed by
// commercial-transition, and `pilot_status` has no 'archived' value at all
// (submitted|review|approved|active|completed|declined), so this handler
// both violated the new FSM-ownership rule and would fail against the enum
// if an authorized admin ever actually invoked it. Removing the export (vs.
// leaving a broken handler wired up) makes DELETE 405 by default; a real
// archive/close action belongs in the commercial-transition FSM, not here.

