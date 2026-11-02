# UE education certification and completion lifecycle integrity — 2026-11-02

Baseline: `42d95a3fb769ae5b61ff2e8659a1d0a56d8e1e3b` on `agents/ue-cursor-final-closure`. Seven substantive baseline GitHub Actions workflows reported success. This evidence records source changes and authored regression tests only; the resulting commit requires independent exact-SHA qualification.

## Defect provenance and scope

Frozen Gate 0B.6 defects: `DEF-0B6-EDU-CERTIFICATION-ISSUED-WITHOUT-COMPLETION-OR-VERIFICATION` and `DEF-0B6-EDU-COMPLETIONS-POST-SKIPS-REGISTRATION-CHECKS` (related lifecycle controls); cross-cutting `DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT`. Do not edit their frozen classification or award CLOSED credit.

## Permanent source correction

- Certification candidate POST accepts only `registrationId` from the client, rejects attempted identity, verification, lifecycle, badge and document fields before querying, and requires a valid UUID-shaped registration identifier. It binds the completed, passed, non-cancelled registration in the current organization to a certification-bearing course in that same organization. The created record remains `pending_verification`, never an issued or independently verified certificate.
- Completion POST now refuses cancelled, waitlisted, unknown-status and otherwise inactive registrations, even when stale attended/passed flags are set. Its update predicate reasserts active status and no cancellation under the row lock. Audit must succeed within the transaction before the response can commit.
- No invented certification verification, mandate, badge generation, payment settlement or independent human ratification is asserted.

## Regression tests authored

`apps/union-eyes/app/api/education/certifications/__tests__/candidate-integrity.test.ts`: forged-field refusals, identity/tenant mismatch, malformed IDs, registration completion/pass/cancellation predicates, non-certifying courses and pending candidate projection.

`apps/union-eyes/app/api/education/completions/__tests__/completion-lifecycle.test.ts`: inactive and cancelled states, unattended refusal, tenant-bound update predicate, row lock, audit ordering and audit-failure refusal.

## Verification boundaries

Source: commit and readback required. Unit/contract: exact-HEAD GitHub Actions required. Native: PG15 and PG16 course-registration and certification-specific transaction tests not yet established by these authored tests. Runtime: actual education completion/certification HTTP/browser and staging journeys not yet established. Gate 0C.4 reviewer, owner-persona ratification and institutional authority remain outstanding. No defect-completion or CLOSED credit.
