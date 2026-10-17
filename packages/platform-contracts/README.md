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
| **Institutional foundation** | `@nzila/platform-contracts` | Explicit scope/reference/binding schemas and trusted-context shape; no inferred institutional authority |

## Usage

```typescript
import type { HealthResponse, HealthContract } from '@nzila/platform-contracts/health'
import { isValidHealthResponse } from '@nzila/platform-contracts/schemas'
```

## Related

Institutional contracts are additive and versioned independently of the existing
org/control-system schemas. Runtime context schemas validate shape, not trust:
server-composed adapters must resolve identity, scope, policies and recorded
authority. See the [accepted operating contract](../../docs/architecture/NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md)
and [local runtime foundation](../institutional-intelligence/README.md).

- `@nzila/platform-ai-contract` — AI output contracts (separate package, narrower scope)
- `docs/platform/PLATFORM_SURFACE_MODEL.md` — Operating shell model
- `docs/architecture/APP_DOMAIN_CORE_STANDARD.md` — Internal app architecture standard
