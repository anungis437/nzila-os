# Union Eyes external-counsel QA seed: physical grievance type

Status: SOURCE_CORRECTED_PENDING_EXACT_HEAD_RUNTIME. No defect or release closure credit.

## Observation

At HEAD d8b63813beafc763b64269a8e16a3be4389fddc6, GitHub Actions workflow 41518613799 (Production-build HTTP, cross-tenant and restart QA) failed during the external-counsel runtime acceptance suite. The QA-only seed command `npx tsx scripts/runtime/external-admin.ts seed` received PostgreSQL `null value in column "type" of relation "grievances" violates not-null constraint`. The synthetic grievance INSERT omitted the physical NOT NULL classification. This failure occurred before the external-counsel READ-path security assertions ran.

## Correction

`apps/union-eyes/scripts/runtime/external-admin.ts` now explicitly inserts `type = 'individual'`, a declared member of `grievance_type`, while preserving its synthetic-fixture designation and QA_TEST_ENV guard. No production authority-issuance surface or grant path was added. A Vitest source-contract test asserts that the fixture's INSERT has a valid, explicit type and balanced columns/values. This contract test is not a substitute for real PostgreSQL or HTTP acceptance.

## Verification and remaining

Source-level: authored change and regression contract. Unit: pending exact-HEAD CI. Native: pending exact-HEAD PG15/16. Runtime: pending rerun of the production-build HTTP/browser acceptance workflow. The original external-counsel journey remains synthetic on the grant issuance side (R-41); neither a production grant issuance nor independent institutional ratification is claimed. No frozen qualification evidence, defect provenance or release-debt index was edited.
