# App Alignment: CORA (Compliance & Operations Risk Assessment)

> Status: **PLANNED** — App not yet created. Defines required conventions.

## Overview

`apps/cora` will be the compliance and risk management portal. It will surface
compliance status, risk scores, and retention enforcement events.

---

## Alignment Checklist (to follow at creation time)

### INV-01: No Shadow AI
- [ ] All AI/LLM calls through `@nzila/ai-sdk`
- [ ] ESLint no-shadow-ai rule active at scaffold

### INV-02: No Shadow ML
- [ ] ML signals accessed via `@nzila/ml-sdk` only

### INV-03: Evidence SSoT
- [ ] Evidence generation via `@nzila/os-core/evidence/generate-evidence-index`
- [ ] CORA may READ evidence packs but not generate them independently

### INV-04: RBAC via Policy Engine
- [ ] All API routes use `authorize()` with `ConsoleRole` or new `CoraRole` extension
- [ ] Compliance-sensitive routes require `requiredScopes: ['admin:retention:read']`

### INV-05: No DEFAULT_ENTITY_ID
- [ ] Entity context sourced from session only

---

## Key Integrations

- **Retention**: Subscribe to `retention.*` audit events to display enforcement history
- **Evidence**: Read-only access to evidence packs via `@nzila/os-core/evidence`
- **Telemetry**: `initOtel()` + `createRequestContext()` middleware

---

## Estimated Effort: 5–7 engineering days (greenfield)
