# @nzila/platform-contracts

Canonical platform contract interfaces for the Nzila OS monorepo.

## Contracts

| Contract | Module | Purpose |
|---|---|---|
| **Health** | `@nzila/platform-contracts/health` | Standard `/api/health` response shape |
| **Metrics** | `@nzila/platform-contracts/metrics` | Structured metrics reporting |
| **Governance** | `@nzila/platform-contracts/governance` | Governance telemetry and compliance checks |
| **Evidence** | `@nzila/platform-contracts/evidence` | Evidence export for audit trails |
| **Environment** | `@nzila/platform-contracts/environment` | Environment declaration and validation |
| **Change** | `@nzila/platform-contracts/change` | Change awareness (deploys, flags, config) |

## Usage

```typescript
import type { HealthResponse, HealthContract } from '@nzila/platform-contracts/health'
import { isValidHealthResponse } from '@nzila/platform-contracts/schemas'
```

## Related

- `@nzila/platform-ai-contract` — AI output contracts (separate package, narrower scope)
- `docs/PLATFORM_SURFACE_MODEL.md` — Operating shell model
- `docs/APP_DOMAIN_CORE_STANDARD.md` — Internal app architecture standard
