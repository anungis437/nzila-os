# Architecture Boundary Policy

> **Status**: Enforced  
> **Last Updated**: 2026-06-01  
> **Owner**: platform-core  

## Overview

Every module in the Nzila OS monorepo belongs to one of four architectural layers.
The dependency rules below are **enforced at CI** via ESLint, contract tests, and the
control-manifest validation gate. No exceptions are granted without a governance waiver.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: apps/                                              │
│  Next.js applications, API services                          │
│  MAY import from: packages/ (via @nzila/* package imports)   │
│  MUST NOT import from: other apps/, services/                │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: services/                                          │
│  Backend microservices (Python, Node)                         │
│  MAY import from: packages/ (when in-workspace)              │
│  MUST NOT import from: apps/                                 │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: packages/                                          │
│  Shared libraries, contracts, platform infrastructure        │
│  MAY import from: other packages/ (if declared in deps)      │
│  MUST NOT import from: apps/, services/                      │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: tooling/                                           │
│  Build tools, contract tests, governance scripts             │
│  MAY import from: packages/ (for contract testing only)      │
│  MUST NOT be imported by: apps/, packages/, services/        │
└──────────────────────────────────────────────────────────────┘
```

## Dependency Rules

| From → To        | Allowed? | Enforcement                  |
|------------------|----------|------------------------------|
| app → app        | ❌ No    | `eslint-arch-boundary.mjs`   |
| app → package    | ✅ Yes   | Package must be in deps      |
| app → service    | ❌ No    | Via API calls only           |
| package → app    | ❌ No    | `eslint-arch-boundary.mjs`   |
| package → package| ✅ Yes   | Must be in package.json deps |
| service → app    | ❌ No    | Via API calls only           |
| tooling → app    | ❌ No    | One-way only (tests ← code)  |

## Import Rules

### 1. No Internal Source Imports

```typescript
// ❌ FORBIDDEN — reaching into internal source
import { helper } from '../../packages/os-core/src/internal/helper'

// ✅ CORRECT — use the published export
import { helper } from '@nzila/os-core'
```

### 2. No Cross-App Imports

```typescript
// ❌ FORBIDDEN — app importing from another app
import { ClaimForm } from '@nzila/union-eyes/components'

// ✅ CORRECT — extract to a shared package
import { ClaimForm } from '@nzila/claim-ui'
```

### 3. No Direct Provider Imports

```typescript
// ❌ FORBIDDEN — bypasses platform security/audit layer
import Stripe from 'stripe'

// ✅ CORRECT — use the platform wrapper
import { createPayment } from '@nzila/payments-stripe'
```

## Canonical Package Hierarchy

```
@nzila/contracts           ← Domain schemas (canonical types, events)
@nzila/platform-contracts  ← Platform surface contracts (health, metrics, governance)
@nzila/os-core             ← Core runtime (evidence, hash, rate-limit, idempotency)
@nzila/enforcement          ← Request enforcement pipeline (auth, audit, governance layers)
@nzila/observability        ← Structured logging, tracing, OTLP export
@nzila/otel-core            ← OpenTelemetry extensions (cost attribution, SLO)
@nzila/platform-governance  ← Governance engine (compliance, audit timeline)
@nzila/platform-auth        ← Auth guards, RBAC, session management
@nzila/db                   ← Database scoping (ScopedDb, AuditedScopedDb)
@nzila/evidence             ← Evidence sealing (Merkle tree, HMAC)
```

## CI Gates

| Gate | Script | Blocks Merge? |
|------|--------|---------------|
| Boundary ESLint | `pnpm lint` | ✅ Yes |
| Contract Tests | `pnpm contract-tests` | ✅ Yes |
| Control Manifests | `pnpm exec tsx tooling/governance/validate-control-manifests.ts` | ✅ Yes |
| Registry Alignment | `registry-alignment.test.ts` | ✅ Yes |
| Org-Scope Check | `registry-org-scope.test.ts` | ✅ Yes |
| Governance Gate | `pnpm exec tsx tooling/governance/validate-governance-gate.ts` | ✅ Yes |

## Violation Remediation

1. **Cross-app import**: Extract shared code into `packages/` and declare the dependency
2. **Internal source import**: Use the package's published exports (check `package.json#exports`)
3. **Direct provider import**: Use the corresponding `@nzila/<provider>` wrapper package
4. **Missing org-scope**: Add `requireOrgScope` middleware or update the registry manifest

## Waiver Process

Temporary waivers can be filed in `governance/exceptions/` with:

- `control`: The violated control ID
- `reason`: Business justification
- `expiresOn`: ISO date (max 90 days)
- `owner`: Responsible team member

Waivers are validated by CI — expired waivers cause build failures.
