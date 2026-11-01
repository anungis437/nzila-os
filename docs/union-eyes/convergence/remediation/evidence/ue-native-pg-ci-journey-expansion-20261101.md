# Union Eyes — native PostgreSQL CI coverage expansion (2026-11-01)

## Scope and authority
Branch: `agents/ue-cursor-final-closure`. Additive engineering/CI evidence only. This does not change any of the frozen 777 defect source registers, 150-item release-debt index, capability inventory, owner-persona baselines or qualification artifacts. No defect-completion, independent acceptance or CLOSED credit is awarded.

## Change
`.github/workflows/ue-native-postgres.yml` previously ran six explicitly named native PostgreSQL test files. It now runs eleven on **each** fresh combined Django + Drizzle PostgreSQL 15 and 16 database, using the existing exact-SHA checkout, isolated loopback-bound container, native Vitest config, real database roles, result JSON and per-version receipt.

Five additional existing native suites are now mandatory:
- `db/__tests__/precedent-library.postgres.test.ts`: the real precedent service and collection/item routes, public/private/restricted decisions, tenant RLS, and owned writes.
- `db/__tests__/clause-library-visibility.postgres.test.ts`: owner, explicit sharing and public clause visibility, real runtime RLS and clause tags.
- `db/__tests__/finance-duties.postgres.test.ts`: financial duties, mandates and transaction/audit behavior under runtime privileges.
- `db/__tests__/document-intake.postgres.test.ts`: document intake, reviewed transcription and signature acknowledgment under real grants.
- `db/__tests__/workaid-union-side.postgres.test.ts`: union-side WorkAid consent, revocation and disclosure under native tenant isolation.

The receipt's `required` list was expanded in parallel. A test file that does not execute is a failing acceptance condition; any skipped test, failed test or unsuccessful Vitest result also fails the receipt. This deliberately broadens detection rather than assuming a previous local run qualifies a new commit.

## Evidence boundary and follow-up
The workflow and receipt changes were committed as `1e32eac600272daec8581b09d59c7b87cd58b7cf`, with YAML comment formatting corrected at `aebfa3d8342014303a2c80b1024408c4f8f788e9`. The initial workflow-file-only run at the first commit failed; its failure is **not** represented as test evidence. At authoring time, no completed exact-HEAD PG15/16 result exists for the expanded suite. Inspect the new workflow jobs and their artifacts, fix any genuine failures without bypassing the privilege/tenant safety floor, and only then credit native verification.

The WorkAid test does not prove counsel-side issuer, key custody or institution-approved legal consent text. These suites do not establish authenticated HTTP/browser/staging journeys, complete 111-capability acceptance, immutable-audit deployment or independent Gate 0C.4 reviewer, owner-persona and institutional decisions.

**Accounting:** 777 provenance defects unchanged; zero new independently CLOSED defects; overall NO_GO.
