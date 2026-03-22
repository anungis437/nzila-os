# @nzila/os-core

Central runtime library for the NzilaOS platform. Provides foundational cross-cutting concerns consumed by every app and most packages in the monorepo.

## Modules

| Module | Import | Purpose |
|--------|--------|---------|
| **Telemetry** | `@nzila/os-core/telemetry` | Structured logging via `AsyncLocalStorage`, request context propagation |
| **Rate Limiting** | `@nzila/os-core/rateLimit` | IP-scoped and org-scoped rate limiting (`checkRateLimit`) |
| **Env Validation** | `@nzila/os-core/config` | Zod-validated environment schemas per app (`validateEnv`) |
| **Policy / AuthZ** | `@nzila/os-core/policy` | Role-based authorization guards (`authorize`, `evaluateGovernanceRequirements`) |
| **Idempotency** | `@nzila/os-core/idempotency` | Idempotent operation tracking (in-memory + Postgres) |
| **Audit** | `@nzila/os-core/audit` | Structured audit trail emission |
| **Evidence** | `@nzila/os-core/evidence` | Evidence pack creation and hash-chain verification (`computeEntryHash`, `verifyChain`) |
| **Resilience** | `@nzila/os-core/resilience` | Circuit breaker, retry, and timeout patterns |
| **Crypto** | `@nzila/os-core/crypto` | Cryptographic hashing and sealing utilities |
| **Classification** | `@nzila/os-core/classification` | Data classification and sensitivity labeling |
| **API Response** | `@nzila/os-core/api-response` | Standard error/success envelope (`apiSuccess`, `apiError`, `ApiError`) |
| **API Handler** | `@nzila/os-core/api-handler` | Next.js App Router route handler wrapper with auth, logging, error handling |

## Quick Start

```ts
// Middleware (apps/*/middleware.ts)
import { checkRateLimit } from '@nzila/os-core/rateLimit'

// Environment validation (app startup)
import { validateEnv } from '@nzila/os-core/config'
const env = validateEnv('console')

// API route handler
import { apiHandler } from '@nzila/os-core/api-handler'
import { apiSuccess } from '@nzila/os-core/api-response'

export const GET = apiHandler({ requireAuth: true }, async (req, ctx) => {
  return apiSuccess({ items: [] }, ctx.requestId)
})
```

## Environment Validation

Every app has a Zod schema in `src/config/env.ts`. Call `validateEnv(appName)` at import time — it throws in production and warns in development for missing variables.

Covered apps: `web`, `console`, `partners`, `union-eyes`, `abr`, `cfo`, `nacp-exams`, `flow`, `zonga`, `orchestrator-api`, `mobility`, `mobility-client-portal`, `agrimo`, `cora`, `trade`, `platform-admin`.

## Standard Middleware Pattern

All Next.js apps should use the 3-layer middleware:

1. **Rate limiting** — `checkRateLimit(request)` returns 429 if exceeded
2. **Clerk auth** — `clerkMiddleware()` for authentication
3. **Request-ID** — Propagate/generate `x-request-id` header

## Source Layout

```
src/
├── abr/              # ABR-specific utilities
├── audit/            # Audit trail
├── classification/   # Data classification
├── config/           # Zod env schemas
├── crypto/           # Hash/seal
├── evidence/         # Evidence packing
├── fin/              # Financial utilities
├── policy/           # Authorization
├── rateLimit/        # Rate limiting
├── resilience/       # Circuit breaker, retry
├── retention/        # Data retention enforcement
├── secrets/          # Secret management
├── telemetry/        # Logging, request context
├── api-handler.ts    # Route handler wrapper
├── api-response.ts   # Error/success envelope
└── index.ts          # Barrel exports
```
