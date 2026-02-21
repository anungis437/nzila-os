# Nzila OS — Vertical Scaffolding Architecture

## Overview

The `nzila create-vertical` CLI command generates new application verticals
that inherit the full Nzila OS governance posture automatically.
A scaffolded vertical immediately passes all contract tests.

## Usage

```bash
# From the repo root
npx tsx packages/cli/src/index.ts create-vertical my-vertical

# Or with the built binary
nzila create-vertical my-vertical

# Preview without writing files
nzila create-vertical my-vertical --dry-run
```

## What Gets Generated

```
apps/my-vertical/
├── package.json              # Dependencies including @nzila/db, @nzila/os-core
├── tsconfig.json             # Standard Nzila OS TypeScript config
├── next.config.ts            # Next.js config with transpilePackages
├── eslint.config.mjs         # ESLint with no-shadow-ai/ml/db rules
├── middleware.ts              # Clerk auth + rate limiting
├── vitest.config.ts          # Test configuration
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── api/
│       ├── health/route.ts   # Public health check
│       └── entities/
│           └── [entityId]/
│               └── example/route.ts  # Example scoped route
├── lib/
│   ├── api-guards.ts         # authorize() + scopedDb + withAudit
│   ├── rbac.ts               # Re-exported RBAC config
│   ├── telemetry.ts          # Telemetry context
│   ├── entity.ts             # Domain schema placeholder
│   └── evidence.ts           # Evidence collector stub
├── ops/
│   └── runbook.md            # Ops pack stub
└── __tests__/
    └── contract.test.ts      # Governance compliance tests
```

## Governance Posture (Automatic)

Every scaffolded vertical includes:

| Protection | Mechanism |
|-----------|-----------|
| Authentication | Clerk middleware (`middleware.ts`) |
| Authorization | `authorize()` from `@nzila/os-core/policy` |
| Entity isolation | `createScopedDb(entityId)` from `@nzila/db/scoped` |
| Automatic audit | `withAudit()` from `@nzila/db/audit` |
| No shadow AI | ESLint `no-shadow-ai` rule |
| No shadow ML | ESLint `no-shadow-ml` rule |
| No shadow DB | ESLint `no-shadow-db` rule |
| Rate limiting | `@nzila/os-core/rateLimit` in middleware |
| Health check | `/api/health` endpoint |
| Contract tests | `__tests__/contract.test.ts` |

## Invariants

| ID | Description | Enforcement |
|----|-------------|-------------|
| INV-10 | CLI generates correct governance posture | Contract test |
| INV-11 | Every API route has authorization | Contract test |

## Extending a Vertical

1. **Add domain schema** — Edit `lib/entity.ts` with your tables (must include `entity_id`)
2. **Add API routes** — Under `app/api/entities/[entityId]/`, always use `requireEntityAccess()`
3. **Add contract tests** — Extend `__tests__/contract.test.ts`
4. **Run validation** — `pnpm contract-tests` must pass

## Related Documents

- [ENTITY_ISOLATION.md](./ENTITY_ISOLATION.md) — Scoped DAL foundation
- [AUDIT_ENFORCEMENT.md](./AUDIT_ENFORCEMENT.md) — Automatic audit emission
- [ENFORCEMENT_SUMMARY.md](./ENFORCEMENT_SUMMARY.md) — Full enforcement layer summary
