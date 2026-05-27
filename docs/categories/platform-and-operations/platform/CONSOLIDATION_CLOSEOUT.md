# Platform Consolidation — Adoption Matrix & Closeout

> Superseded for current authority/adoption consolidation by `docs/platform/PLATFORM_CONSOLIDATION_COMPLETION_REPORT.md` (2026-04-14).

> Branch: `feat/platform-consolidation-10`
> Date: 2026-04-11
> Total: 92 files changed, 3,767 insertions, 271 deletions

---

## Commits

| # | Commit | Phase | Summary |
|---|--------|-------|---------|
| 1 | `a31cfbe2` | 1+2 | `@nzila/schema-core` (15 source files, 32 tests) + NzilaAppShell + 14 app layouts |
| 2 | `138c2a7a` | 3 | `@nzila/governed-workflow` (10 source files, 21 tests) |
| 3 | `07ba343c` | 4 | `createAppBoot()` + standardize all 17 app instrumentation files (14 tests) |
| 4 | `7887dcde` | 5 | Platform adoption gate (60/60 checks) + wire schema-core/governed-workflow deps |
| 5 | `5bf66659` | 6 | Persona docs spine (buyer, operator, auditor) |
| 6 | — | 7 | This closeout artifact |

---

## Adoption Matrix

### Shell (`@nzila/platform-shell` → NzilaAppShell)

| App | Status | Notes |
|-----|--------|-------|
| abr | ✅ Adopted | Layout wired |
| agrimo | ✅ Adopted | Layout wired |
| cfo | ✅ Adopted | Layout wired |
| console | ✅ Adopted | Layout wired |
| control-plane | ✅ Adopted | Layout wired |
| cora | ✅ Adopted | Layout wired |
| flow | ✅ Adopted | Layout wired |
| mobility | ✅ Adopted | Layout wired |
| mobility-client-portal | ⚠️ Exempt | External client portal — own branding |
| nacp-exams | ✅ Adopted | Layout wired |
| partners | ✅ Adopted | Layout wired |
| platform-admin | ✅ Adopted | Layout wired |
| trade | ✅ Adopted | Layout wired |
| web | ⚠️ Exempt | Public marketing site — own nav/footer |
| zonga | ✅ Adopted | Layout wired |
| union-eyes | ⚠️ Exempt | Django hybrid — shell-free SSR |
| orchestrator-api | ⚠️ Exempt | Fastify (non-Next.js) |

**Score: 13/13 governed + 4 documented exceptions**

### Schema-Core (`@nzila/schema-core`)

| App | Status |
|-----|--------|
| All 15 governed apps | ✅ Dependency declared |
| orchestrator-api | ⚠️ Exempt (Fastify) |

**Score: 15/15 governed + 1 exception**

### Governed-Workflow (`@nzila/governed-workflow`)

| App | Status |
|-----|--------|
| All 15 governed apps | ✅ Dependency declared |

**Score: 15/15 governed**

### Observability (`createAppBoot` in `instrumentation.ts`)

| App | Status | Notes |
|-----|--------|-------|
| All 15 governed apps | ✅ Canonical boot | `createAppBoot('appName')` |
| union-eyes | ⚠️ Exempt | 156-line custom heavyweight (DB checks, Redis, Sentry, console wrapper) |
| orchestrator-api | ⚠️ Exempt | Fastify pattern (non-Next.js) |

Special configurations:

- `web`: `createAppBoot('web', { skipMetrics: true, skipBootAssert: true })`
- `flow`: `createAppBoot('flow')` + custom `initEventPersistence` addon
- `zonga`: `createAppBoot('zonga')` + Sentry addon + `onRequestError` export

**Score: 15/15 governed + 2 exceptions**

---

## New Packages

### `@nzila/schema-core` v1.0.0

13 domain Zod modules: actor, audit, correlation, document, entity, error,
event, evidence, financial, integration, module, org, workflow.

Plus: `Result<T>` monad, `isResult`/`isOk`/`isErr` guards.

- **32/32 tests passing**
- ESLint config included

### `@nzila/governed-workflow` v0.1.0

Ingestion → FSM → Evidence orchestrator.

- `GovernedWorkflowBuilder` + `workflow()` fluent factory
- `executeGovernedWorkflow()` pure function
- `registerWorkflow`/`getWorkflow`/`listWorkflows` registry
- `workflowStartedEvent`/`workflowCompletedEvent` bridge

- **21/21 tests passing**

### `createAppBoot()` (in `@nzila/os-core/telemetry`)

Canonical Next.js boot function: initOtel → initMetrics → validateEnv → assertBootInvariants.

- `AppBootOptions`: skipEnvValidation, skipBootAssert, skipMetrics
- Guards: Edge runtime + build phase skip
- Graceful degradation per-step; fail-fast only for boot invariants in production

- **14/14 tests passing**

---

## CI Gate

**`pnpm exec tsx scripts/platform-adoption-gate.ts`** — 60/60 checks passing.

Wired into `pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts` composite. Fail-closed — any regression
blocks deployment.

Checks per app (4):

1. Shell import from `@nzila/platform-shell`
2. `@nzila/schema-core` in dependencies
3. `@nzila/governed-workflow` in dependencies
4. `instrumentation.ts` with `createAppBoot` import

---

## Test Summary

| Package | Tests | Status |
|---------|-------|--------|
| schema-core | 32 | ✅ All passing |
| governed-workflow | 21 | ✅ All passing |
| os-core (boot) | 14 | ✅ All passing |
| **Total** | **67** | ✅ |

---

## Documented Exceptions

| App | Exemption | Reason |
|-----|-----------|--------|
| web | Shell | Public marketing site with custom nav/footer |
| mobility-client-portal | Shell | External client portal with own branding |
| union-eyes | Shell, Observability | Django hybrid — 156-line custom instrumentation |
| orchestrator-api | Shell, Schema-core, Observability | Fastify (non-Next.js) |

All exceptions are documented in `scripts/platform-adoption-gate.ts` in the
`KNOWN_EXCEPTIONS` record and enforced by CI.

---

## Readiness Assessment

| Criterion | Status |
|-----------|--------|
| All governed apps adopt platform shell | ✅ 13/13 + 4 exceptions |
| Canonical domain schemas via schema-core | ✅ 15/15 apps |
| Provable ingestion→FSM→evidence pipeline | ✅ governed-workflow package |
| Standardized observability boot | ✅ 15/15 + 2 exceptions |
| CI enforcement (fail-closed, no skip flags) | ✅ 60/60 gate |
| Persona-based documentation | ✅ buyer, operator, auditor |
| All new packages have tests | ✅ 67/67 |
| Exceptions documented and CI-enforced | ✅ |

**Platform consolidation complete. All seven phases delivered.**
