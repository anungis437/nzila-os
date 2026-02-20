# App Alignment: ABR (Automated Business Reports)

> Status: **PLANNED** — App not yet created. This document defines conventions to follow.

## Overview

`apps/abr` will be the automated business reporting application, generating
periodic performance reports for entities and partners.

---

## Alignment Checklist (to follow at creation time)

### INV-01: No Shadow AI
- [ ] All AI calls go through `@nzila/ai-sdk` from day one
- [ ] ESLint no-shadow-ai rule active in `eslint.config.mjs` at scaffold

### INV-02: No Shadow ML
- [ ] ML data accessed via `@nzila/ml-sdk` control plane only

### INV-03: Evidence SSoT
- [ ] No local evidence generation — use `@nzila/os-core/evidence/generate-evidence-index`

### INV-04: RBAC via Policy Engine
- [ ] Auth uses `@nzila/os-core/policy` `authorize()`
- [ ] Define required roles in `ConsoleRole` enum before building routes

### INV-05: No DEFAULT_ENTITY_ID
- [ ] Entity ID always sourced from Clerk user metadata or API parameter

---

## Architecture Requirements

- Must use `@nzila/os-core/telemetry` for structured logging
- Health endpoint at `/api/health` returning standard shape
- `validateEnv('abr')` at startup (add app-specific schema to config/env.ts)
- Middleware using `createRequestContext()` for request correlation

---

## Estimated Effort: 3–5 engineering days (greenfield)
