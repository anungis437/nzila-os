# 18 - Gate 7 Evidence Export Boundary Proof

## Gate Decision

`LIUNA_GATE_7_EVIDENCE_EXPORT = STAFF_SCOPED_SAFE_SNAPSHOT_PROVEN`

The live `/api/evidence/export` route is now covered by a focused route test that proves the LIUNA-relevant boundary for recording and discovery:

- plain member roles receive `403`;
- denied member requests do not increment the evidence-export telemetry counter;
- governance/staff roles receive an organization-scoped evidence snapshot;
- the payload carries policy, lifecycle, pipeline, and organization-isolation metadata;
- the payload does not expose raw document, matter, or record collections.

## Validation

Source and test:

- `apps/union-eyes/app/api/evidence/export/route.ts`
- `apps/union-eyes/app/api/__tests__/evidence-export.route.test.ts`

The test uses a synthetic scope:

`liuna-opdc-cecof-synthetic`

No LIUNA production data, privileged records, or client-owned documents are used.

## Claim Boundary

This gate supports a truthful recording claim that Union Eyes has a staff-scoped governance evidence snapshot with organization-isolation metadata.

It does not prove full legal chain of custody, complete matter export authorization, privileged document package export, or e-discovery certification.

## Remaining Sensitive-Pilot Gap

Evidence export is no longer the core blocker inside LIUNA-F02. AI briefing, notification, and former-user/offboarding boundaries remain separate sensitive-pilot proof items.
