# Union Eyes Gate 0 — geofence service/HTTP tenant transaction and privacy audit (2026-11-01)

Source baseline: `c4fab8f99970e76c32ac2b2d59cb5eb908d1bc19` on `agents/ue-cursor-final-closure`.

The geofence GET route previously invoked `checkGeofenceEntry` outside `withRLSContext`. The service used the ambient database for its geofence read, consent read, global-policy read and GPS entry-event write. Although it compared `unionLocalId` before returning a geofence, the actual database operations were not bound to the caller's tenant transaction. A consented geofence entry could be persisted without an atomic application audit. The service also accepted a direct caller-supplied `strikeId` even though the HTTP route refused unverified associations.

The route now invokes the service inside `withRLSContext({ organizationId })`, passes the same transaction through geofence lookup, consent and policy reads, and event persistence, and writes a coordinate-free `location.geofence.entry` audit in that transaction whenever an entry is recorded. An audit failure propagates and should roll back the transaction. Direct service calls cannot create geofences with unverified strike associations; ordinary unlinked geofence creation and non-persisting spatial lookup remain supported.

Adversarial tests were authored in `apps/union-eyes/app/api/location/__tests__/geofence-route.test.ts` and `apps/union-eyes/services/__tests__/geofence-privacy-service.test.ts` for transaction propagation, tenant-scoped reads, missing audit and no coordinate leakage, and direct service rejection of forged strike associations.

**Qualification state: SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED.** No exact-HEAD focused/full Vitest, contract, real PG15/16, HTTP/browser or staging evidence was established at authoring. Native/HTTP workflows on the preceding baseline failed bootstrap because migration 0048 exposes SECURITY DEFINER functions executable by runtime principals; do not bypass the catalog privilege preflight. Independent reviewer, owner-persona and institutional decisions remain outstanding.

Frozen 777-defect provenance untouched. Zero new implementation, qualification or CLOSED credit.
