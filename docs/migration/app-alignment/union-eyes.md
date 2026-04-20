# App Alignment: union-eyes

> Status: **COMPLETE** — All os-core contract checklist items satisfied

## Overview

`apps/union-eyes` is the data intelligence and analytics dashboard. It consumes
ML model outputs, deal analytics, and entity-level signals.

---

## Alignment Checklist

### INV-01: No Shadow AI

- [x] All AI calls go through `@nzila/ai-sdk` (no direct `openai`, `anthropic`, `@google-ai/generativelanguage` imports)
- [x] ESLint no-shadow-ai rule active in `eslint.config.mjs`

### INV-02: No Shadow ML

- [x] ML data accessed via `@nzila/ml-sdk` or `@nzila/ai-sdk` control plane
- [x] No direct imports of `mlScoresStripeTxn`, `mlScoresStripeDaily`, `mlModelRuns` from `@nzila/db`

### INV-03: Evidence SSoT

- [x] No local evidence generation logic — use `@nzila/os-core/evidence/generate-evidence-index`

### INV-04: RBAC via Policy Engine

- [x] Auth uses `@nzila/os-core/policy` `authorize()` — not raw Clerk role checks
- [x] `UERole` enum covers all required roles

### INV-05: No DEFAULT_ENTITY_ID

- [x] No hard-coded `DEFAULT_ENTITY_ID` in app code

---

## Telemetry Integration

- [x] `initOtel()` called at app bootstrap (`instrumentation.ts`)
- [x] `createRequestContext()` wired into `middleware.ts` (Edge-safe `x-request-id` propagation)
- [x] `createLogger()` used in all API routes (via `@nzila/os-core/telemetry`)

## Health Endpoint

- [x] `GET /api/health` implemented at [app/api/health/route.ts](../../../apps/union-eyes/app/api/health/route.ts)

## Environment Validation

- [x] `validateEnv('union-eyes')` called in startup (`instrumentation.ts`)

---

## Migration Log

| Commit | Description |
|--------|-------------|
| `95f4b9e` | INV-01: Replace shadow AI imports with `@nzila/ai-sdk` (6 files, new `ai-client.ts` factory) |
| `7545585` | INV-04: Wire RBAC through os-core policy engine (new `policy-adapter.ts`) |
| `35dd988` | Telemetry: `initOtel`, `initMetrics`, `validateEnv`, `createLogger`, `x-request-id` middleware |

## Branch: `chore/ue-os-alignment-migration`
