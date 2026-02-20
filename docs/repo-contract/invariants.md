# Repo Invariants

Each invariant below is enforced by a **specific code gate**. If a violation occurs that has no gate, a new gate must be added immediately.

## INV-01 — No Shadow AI
- **Rule**: Apps must NOT import `openai`, `@azure/openai`, `anthropic`, `@anthropic-ai/*`, `@google/generative-ai`, `cohere-ai` directly.
- **Gate**: `packages/ai-sdk/eslint-no-shadow-ai.mjs` ESLint rule enabled in every `apps/*/eslint.config.mjs`
- **Contract test**: `tooling/contract-tests/invariants.test.ts` → INV-01
- **CI step**: `pnpm -r lint` (includes no-shadow-ai)

## INV-02 — No Shadow ML (Direct Table Reads)
- **Rule**: Apps must NOT import ML score tables (`mlScores*`, `mlModels`, etc.) directly from `@nzila/db/schema`.
- **Gate**: `packages/ml-sdk/eslint-no-shadow-ml.mjs` ESLint rule
- **Contract test**: `tooling/contract-tests/invariants.test.ts` → INV-02
- **CI step**: `pnpm -r lint`

## INV-03 — Evidence Generator SSoT
- **Rule**: Business logic for evidence pack generation lives ONLY in `packages/os-core/src/evidence/generate-evidence-index.ts`. The tooling script is a thin CLI wrapper.
- **Gate**: `tooling/contract-tests/no-duplicate-evidence-generator.test.ts`
- **CI step**: Contract tests job in `ci.yml`

## INV-04 — RBAC authorize() on Every API Route
- **Rule**: Every `app/api/**/route.ts` must call `authorize()` from `@nzila/os-core/policy`.
- **Gate**: `tooling/contract-tests/api-authz-coverage.test.ts`
- **CI step**: Contract tests job

## INV-05 — No DEFAULT_ENTITY_ID in Partners
- **Rule**: The partners app must never use a hardcoded entity. All entity access must come from `partner_entities`.
- **Gate**: `tooling/contract-tests/invariants.test.ts` → INV-05
- **CI step**: Contract tests job

## INV-06 — Schema Changes Require Migrations
- **Rule**: Any PR that modifies `packages/db/src/schema/**` must include a drizzle migration file.
- **Gate**: `tooling/contract-tests/migration-policy.test.ts`
- **CI step**: Contract tests job

## INV-07 — Health Endpoint on Every App
- **Rule**: Every app must expose `GET /api/health` returning at minimum `{ status: "ok" }`.
- **Gate**: `tooling/contract-tests/invariants.test.ts` and manual gate check
- **CI step**: `pnpm -r build` + integration smoke test

## INV-08 — Security Scans Must Pass
- **Rule**: No high/critical CVEs without a waiver artifact in Blob.
- **Gate**: `.github/workflows/dependency-audit.yml` + `sbom.yml`
- **CI step**: Security scan jobs

## Adding a New Invariant

1. Document it here with Rule + Gate + CI step.
2. Add/update the corresponding test in `tooling/contract-tests/`.
3. Add the CI step to `.github/workflows/ci.yml` if not already covered.
4. Never add an invariant without a code gate.
