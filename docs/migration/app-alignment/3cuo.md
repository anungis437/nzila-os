# App Alignment: 3CUO (Three-Tier Capital Utilisation Optimiser)

> Status: **PLANNED** — App not yet created. Defines required conventions.

## Overview

`apps/3cuo` will be the capital utilisation optimisation tool. It models
three-tier capital allocation scenarios and provides decision-support
recommendations.

---

## Alignment Checklist (to follow at creation time)

### INV-01: No Shadow AI
- [ ] All recommendation AI calls through `@nzila/ai-sdk`
- [ ] Financial model inference routes use `@nzila/ai-sdk` control plane
- [ ] ESLint no-shadow-ai rule active at scaffold

### INV-02: No Shadow ML
- [ ] Optimisation model outputs via `@nzila/ml-sdk`
- [ ] No direct `mlScores*` table queries

### INV-03: Evidence SSoT
- [ ] Model runs produce evidence artifacts via `@nzila/os-core/evidence/collectors/ai-evals`

### INV-04: RBAC via Policy Engine
- [ ] All routes use `authorize()` — optimisation scenarios are entity-scoped
- [ ] New roles (`3cuo:analyst`, `3cuo:viewer`) defined in `ConsoleRole` or extension

### INV-05: No DEFAULT_ENTITY_ID
- [ ] All scenario computations are tied to an explicit entity ID

---

## Key Integrations

- **AI SDK**: Scenario generation uses AI-powered recommendations
- **ML SDK**: Capital allocation optimisation models
- **Stripe**: Revenue inputs sourced via `@nzila/payments-stripe`
- **Telemetry**: `initOtel()` + structured logging throughout

---

## Estimated Effort: 7–10 engineering days (greenfield, complex domain)
