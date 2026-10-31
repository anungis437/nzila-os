# UE Gate 0 — calendar sync grant and outcome integrity

Engineering evidence only. This is not an independent qualification, an owner-persona ratification, a CLOSED defect or a release authorization.

## Scope and source

- Route: `apps/union-eyes/app/api/calendar-sync/connections/[id]/sync/route.ts`.
- Behavioral tests: `apps/union-eyes/app/api/calendar-sync/connections/[id]/sync/route.test.ts`.
- Source commits: `3be4129213f91a533bc1b6872371822875e7331c` and `7997a6e4206d733a4529ead94ebc816fb098b8f0`.
- The 777-defect register, 150-item release-debt index, qualification artifacts and original provenance were not modified. No defect receives new implementation or CLOSED credit from this supplemental record.

## Correction

1. Connection `syncEnabled` must be explicitly true. Missing, null or disabled is refused before provider access.
2. Configured `syncDirection` must be one of import/export/both. A caller cannot override an import-only connection to export, or an export-only connection to import; unknown configuration fails closed.
3. The request schema is strict, and external calendar identifiers are bounded.
4. Connection state update must return an updated row before an audit of successful sync can be written. Disconnected/deleted connections are not reported as synced.
5. Raw provider exception messages are neither stored in `syncError` nor returned in HTTP responses; a generic failure is retained.

## Evidence separation and limitations

- **Source:** committed, with tests authored. Readback is required at the final HEAD.
- **Unit:** the focused Vitest cases must execute successfully against the committed source. Auth and provider dependencies are mocked in the route tests.
- **Native PG15/16:** exact-HEAD acceptance must prove tenant scoping, the zero-row update branch and transaction rollback for failed audit persistence.
- **Runtime:** real OAuth provider consent, calendar mapping, external import/export, revocation races and browser/HTTP journeys remain unproven by these source changes.
- **Institutional:** independent reviewer, persona owners and institutional authorities must ratify the appropriate controls. Do not promote or mark CLOSED without that evidence.

A provider effect and local database update cannot share one transaction; ambiguous provider outcomes require durable reconciliation and must not be presented as guaranteed exactly-once sync.
