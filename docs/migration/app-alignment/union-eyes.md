# App Alignment: union-eyes

> Status: **IN PROGRESS** — Tracking alignment to @nzila/os-core contracts

## Overview

`apps/union-eyes` is the data intelligence and analytics dashboard. It consumes
ML model outputs, deal analytics, and entity-level signals.

---

## Alignment Checklist

### INV-01: No Shadow AI
- [ ] All AI calls go through `@nzila/ai-sdk` (no direct `openai`, `anthropic`, `@google-ai/generativelanguage` imports)
- [ ] ESLint no-shadow-ai rule active in `eslint.config.mjs`

### INV-02: No Shadow ML
- [ ] ML data accessed via `@nzila/ml-sdk` or `@nzila/ai-sdk` control plane
- [ ] No direct imports of `mlScoresStripeTxn`, `mlScoresStripeDaily`, `mlModelRuns` from `@nzila/db`

### INV-03: Evidence SSoT
- [ ] No local evidence generation logic — use `@nzila/os-core/evidence/generate-evidence-index`

### INV-04: RBAC via Policy Engine
- [ ] Auth uses `@nzila/os-core/policy` `authorize()` — not raw Clerk role checks
- [ ] `UERole` enum covers all required roles

### INV-05: No DEFAULT_ENTITY_ID
- [ ] No hard-coded `DEFAULT_ENTITY_ID` in app code

---

## Telemetry Integration
- [ ] `initOtel()` called at app bootstrap
- [ ] `createRequestContext()` wired into `middleware.ts`
- [ ] `createLogger()` used in all API routes

## Health Endpoint
- [x] `GET /api/health` implemented at [app/api/health/route.ts](../../apps/union-eyes/app/api/health/route.ts)

## Environment Validation
- [ ] `validateEnv('union-eyes')` called in startup

---

## Migration Steps

1. Audit current AI usage — scan for provider SDK imports
2. Replace any direct provider calls with `@nzila/ai-sdk`
3. Add ESLint no-shadow-ai to `eslint.config.mjs`
4. Replace any direct ML table queries with `@nzila/ml-sdk`
5. Wire up policy engine authorize() in all API routes
6. Add telemetry middleware

---

## Estimated Effort: 2–3 engineering days
