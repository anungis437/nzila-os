# Union-Eyes — World-Class 10/10 Hardening Plan

> Generated: 2026-03-05 | Baseline audit + implementation plan

---

## Phase 0 — Baseline Audit Results

### Lint (`pnpm -C apps/union-eyes lint`)

- **Result: PASS** — 0 errors, 0 warnings reported

### Typecheck (`pnpm -C apps/union-eyes typecheck`)

- **Result: PASS** — 0 errors

> **Note:** `tsconfig.json` currently excludes `services/**`, `backend/**`, `infra/**`,
> `db/schema/**`, `db/migrations/**`, `db/queries/**`, and several `lib/` subdirectories
> from type-checking. Also uses `noImplicitAny: false`. These exclusions hide ~200+ TS
> errors (tracked in `ts-errors-210.txt` / `ts-errors-272.txt`). Hardening moves these
> files under the include scope or tightens the compiler.

### Tests (`pnpm -C apps/union-eyes test`)

- **Result:** "No test files found" — passes only via `--passWithNoTests`
- **0 actual test files** exist under union-eyes today.
- `vitest.config.ts` excludes `services/**` from the test runner.

### Console Usage

- 0 runtime `console.*` calls in `actions/`, `services/`, `lib/`, `app/`, `components/`
- Structured logger at `lib/logger.ts` already in use everywhere
- `console.log` only in seed scripts + doc examples (allowed)

### `any` Usage

| Layer | Count | Files |
|-------|-------|-------|
| `actions/` | 32 | admin-actions, analytics-actions, credits-actions, member-segments-actions, whop-actions |
| `services/` | 100+ | 16+ files — pki/signature-service (25+), clc/compliance-reports (12+), fcm-service (11) |

### Architecture Boundary Violations

- Existing contract tests (`ue-no-raw-db`, `ue-org-scoped-registry`, `ue-rls-org-context`, etc.) cover DB access guarding
- **Missing:** No explicit contract for component → db/infra import boundaries

### Existing UE Contract Tests (in `tooling/contract-tests/`)

- `ue-no-raw-db.test.ts` — app-layer can't use raw DB without RLS
- `ue-org-scoped-registry.test.ts` — org-scoped table registry consistency
- `ue-rls-org-context.test.ts` — RLS org context enforcement
- `ue-role-graph.test.ts` — RBAC role graph validation
- `ue-audited-mutations.test.ts` — auditing on mutations
- `ue-evidence-adoption.test.ts` — evidence adoption coverage
- `ue-evidence-seal.test.ts` — evidence seal enforcement

---

## Hardening Epics

### Epic 1 — Type Purity (Phase 1)

**Goal:** Eliminate reliance on `noImplicitAny: false` and `tsconfig.exclude` for type safety.

| PR | Acceptance | Files Impacted |
|----|-----------|----------------|
| PR-1a: Fix `any` in actions | All action files use typed DTOs | `actions/*.ts`, `types/actions/actions-types.ts` |
| PR-1b: Add Zod schemas for action inputs | All external inputs validated via Zod | `actions/*.ts`, `lib/validation.ts` |
| PR-1c: Move ts-errors-*.txt to plans/ | App root clean | `ts-errors-210.txt`, `ts-errors-272.txt` → `docs/plans/tech-debt/` |

**Acceptance:** `pnpm -C apps/union-eyes typecheck` passes with 0 errors (already passes; maintain it)

### Epic 2 — Architecture Contracts (Phase 2)

**Goal:** Enforce import boundaries at the app layer.

| PR | Acceptance | Files Impacted |
|----|-----------|----------------|
| PR-2a: UE component boundary contract test | components/ cannot import from db/, infra/, services/ | `tooling/contract-tests/ue-component-boundary.test.ts` |
| PR-2b: UE layer contract test | db/ cannot import from actions/, services/, app/ | `tooling/contract-tests/ue-layer-boundary.test.ts` |

**Acceptance:** new contract tests fail on violations, pass on current code

### Epic 3 — Test Stack (Phase 3)

**Goal:** Real unit + integration + E2E coverage.

| PR | Acceptance | Files Impacted |
|----|-----------|----------------|
| PR-3a: Unit tests for actions + services | ≥10 test cases for RBAC, org scoping, credits | `actions/__tests__/*.test.ts` |
| PR-3b: Integration tests for server actions | create→assign→status, break-glass, audit emission | `app/__tests__/*.test.ts` |
| PR-3c: Playwright E2E setup | smoke tests: login, dashboard, create case | `e2e/*.spec.ts`, `playwright.config.ts` |
| PR-3d: Remove --passWithNoTests | CI fails on 0 tests | `package.json` |

**Acceptance:** `pnpm -C apps/union-eyes test` runs real tests; `pnpm -C apps/union-eyes e2e` runs headless

### Epic 4 — A11y + Perf + Error UX (Phase 4)

**Goal:** Accessible, performant, user-friendly error handling.

| PR | Acceptance | Files Impacted |
|----|-----------|----------------|
| PR-4a: jsx-a11y lint plugin | key screens pass a11y lint | `eslint.config.mjs` |
| PR-4b: Error boundaries + stable codes | consistent error UI with codes | `components/error-boundary.tsx`, `lib/error-codes.ts` |
| PR-4c: Bundle budget config | ANALYZE mode + CI threshold | `next.config.ts`, CI config |

**Acceptance:** 0 critical axe violations, no raw stack traces in UI

### Epic 5 — CAPE-ACEP Pilot Hardening (Phase 5)

**Goal:** Pilot-ready environment with org scoping and evidence export.

| PR | Acceptance | Files Impacted |
|----|-----------|----------------|
| PR-5a: Seed script verification | fresh DB + seed → pilot ready < 5 min | `db/seeds/seed-cape-acep.ts` |
| PR-5b: Evidence export in UI | pilot admin can export evidence pack from dashboard | `components/admin/evidence-export.tsx` |

**Acceptance:** pilot admin workflow end-to-end without CLI

---

## Final Gate Checklist

- [ ] `pnpm -C apps/union-eyes lint` — PASS
- [ ] `pnpm -C apps/union-eyes typecheck` — PASS (0 errors)
- [ ] `pnpm -C apps/union-eyes test` — PASS (real tests, no `--passWithNoTests`)
- [ ] `pnpm -C apps/union-eyes e2e` — PASS (Playwright headless)
- [ ] `pnpm contract-tests` — PASS (repo-wide, including new UE contracts)
