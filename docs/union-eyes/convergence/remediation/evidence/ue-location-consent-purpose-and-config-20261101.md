# Union Eyes Gate 0: location purpose and policy fail-closed correction — 2026-11-01

Baseline: `c4033a4c65acff8606d6c8eeba6e0e08bccf5d62` on `agents/ue-cursor-final-closure`.

The service previously accepted a generic location opt-in for meeting, organizing or unknown purposes because they resolved to an undefined consent context. It also created a globally enabled location-tracking policy on the first read when none was configured. An unlinked union-hall or safety-zone geofence could persist precise coordinates under generic consent.

Source correction: strike/picket requires strike permission; event requires event permission; other purposes refuse explicitly and the HTTP route no longer advertises them. The global configuration read is side-effect free and missing configuration refuses tracking. Tracking requires enabled tracking, background disabled, explicit opt-in and automatic deletion. A geofence without a verified strike link can still answer the spatial question but does not store coordinates.

Regression tests authored in `apps/union-eyes/services/__tests__/geofence-privacy-service.test.ts` and `apps/union-eyes/app/api/__tests__/location-track.route.test.ts`. They cover unapproved purposes, cross-purpose consent, missing/unsafe configuration, geofence persistence, and absence of a false compliance claim.

**Qualification:** Source-level only; focused Vitest, complete application/contract, native PostgreSQL 15/16 RLS, HTTP/browser/staging and institutional consent-policy acceptance are not established. Frozen 777-defect provenance and release-debt index are unchanged. No implementation, CLOSED, human ratification or GO credit.

## Additional source correction: unverified links
The tracking route previously accepted arbitrary `strikeId` and `eventId` UUIDs without checking their organization ownership, and the service would persist them as associations. Both the route and service now refuse these associations until an organization-bound lookup is implemented; tracking without those identifiers remains available under the appropriate consent. Adversarial regression tests cover both link types and no-write behavior.

## Remaining storage-authority reconciliation
`apps/union-eyes/db/rls-storage-authority/reference-latent.ts` still declares runtime INSERT on the global `location_tracking_config` table and describes lazy default creation. This no longer matches the corrected read-only service. Removing that grant requires the source-governed privilege contract and migration to be reconciled and qualified; **this commit does not alter or bypass the privilege preflight**.
