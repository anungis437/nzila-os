# Union Eyes Gate 0 — supplemental location privacy fail-closed remediation (2026-10-31)

## Scope and provenance
Branch: `agents/ue-cursor-final-closure`.
This is **supplemental engineering evidence**, not a new defect ID and not an accepted Gate 0 closure. The frozen 777-defect register, 150-item release-debt index, qualification records, and institutional decisions are unchanged. Do not increase implementation or qualification totals based on this note.

## Source changes
- `apps/union-eyes/lib/services/geofence-privacy-service.ts`: a failed consent lookup no longer masquerades as an absent consent in `requestLocationPermission` or `getLocationConsentStatus`. These operations propagate the database failure instead.
- `verifyNoBackgroundTracking` no longer converts a failed database scan into an empty list and a false `compliant: true` finding. The dependent `generateGeofencePrivacyReport` also fails rather than issuing a clean compliance report on database failure.
- Legacy location write and consent revocation errors return generic failure text rather than database exception details. A location write still fails closed if its consent lookup fails.

## Regression evidence authored
`apps/union-eyes/lib/services/__tests__/geofence-privacy-service.test.ts` covers failed consent reads, failed compliance scans, failed compliance reports, and database-detail suppression. The tests were updated to reject the former empty-success behavior.

Source commits: `9d8d64723bb6c07af3ac89129699aa5ddb77a5b7`, `524311d61a1c11e9ea4a3ac7472588165143bc20`, `a3637568fc0d63b5473aa087d7e2a2ca64deefe5`, `e4f82ce46c85e4507d080f89a3a8e446a9d35973`.

## Qualification matrix
| Layer | Disposition |
| --- | --- |
| Source | Authored and committed; source readback required at final HEAD. |
| Unit | Regression cases authored; execution not yet proven at final HEAD. |
| Native PG15/16 | Not proven for these legacy helpers. |
| HTTP/browser/staging | Not proven for these helpers. |
| Institutional | No independent reviewer, persona owner or release authority ratification. |

## Remaining concerns
This legacy helper is not the canonical authenticated `/api/location/consent` route and uses a shared database handle. Its global compliance scan has no explicit platform authority or complete-scan attestation; therefore the change is **not** proof of cross-tenant or institution-wide compliance. Do not use it to certify a release. The canonical member-facing location notice and explicit acknowledgment journey still requires UI/runtime qualification. All original Gate 0 defects and persona/capability obligations remain in scope.
