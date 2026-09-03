/**
 * CRUD item route for pilot applications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';
import { authorizePilotAccess, getPilotEffectiveOrganizationId, withPilotOwnership } from '@/lib/pilot/pilot-ownership';
import { stripReservedResponsesKeysForPatch } from '@/lib/pilot/responses-authority';

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
    // PR #752 round 25: platform-approved commercial terms — the ONLY
    // legitimate writer is approveCommercialTerms() via POST
    // .../approve-commercial-terms (system_admin+). See
    // lib/pilot/commercial-terms-authority.ts.
    'verifiedMemberCount',
    'verifiedPilotAmount',
    'verifiedSubscriptionPlanId',
    'commercialTermsApprovedBy',
    'commercialTermsApprovedAt',
  ],
  // PR #752 round 24: responses holds both the CLAIMED owning organization
  // and commercial-transition's authoritative FSM/scoring state — nested
  // JSONB subfields blockedPatchFields (flat top-level keys) can't protect.
  // Strip every reserved key from the client's PATCH fragment (never read
  // or reproduce its current value), then MERGE the remainder into the
  // existing responses column (mergeJsonColumns below) rather than
  // replacing it whole — a concurrent platform write to a reserved key can
  // therefore never be reverted by this PATCH. See
  // stripReservedResponsesKeysForPatch's doc comment in
  // lib/pilot/responses-authority.ts for the full key list/rationale.
  beforeUpdate: (updates) => {
    if ('responses' in updates && updates.responses && typeof updates.responses === 'object' && !Array.isArray(updates.responses)) {
      updates.responses = stripReservedResponsesKeysForPatch(updates.responses as Record<string, unknown>);
    }
    return updates;
  },
  mergeJsonColumns: ['responses'],
  // PR #752 round 25: withPilotOwnership's own pre-check (below) runs on an
  // UNLOCKED read, before this factory's transaction even starts — a
  // concurrent platform rebind could change the pilot's effective owner
  // between that pre-check and this PATCH's own `SELECT ... FOR UPDATE`.
  // Re-run the SAME ownership decision against the row THIS transaction
  // just locked, so the check and the mutation are atomic with respect to
  // rebinds regardless of what the earlier pre-check saw.
  lockedAuthCheck: async (existing) => {
    const decision = await authorizePilotAccess(
      getPilotEffectiveOrganizationId(
        existing as { responses?: Record<string, unknown> | null; verifiedOrganizationId?: string | null },
      ),
    );
    return decision.ok ? { ok: true } : { ok: false, status: decision.status === 401 ? 401 : 403 };
  },
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

