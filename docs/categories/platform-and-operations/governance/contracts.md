# Governance Contract Tests

> Automated architectural invariants enforced on every PR.

## Quick Start

```bash
# Run all contract tests from repo root
pnpm contract:test
# or
pnpm contract-tests
```

## Rules

| Rule ID | Name | File | What it enforces |
|---|---|---|---|
| `TS_STRICT_001` | No strict:false | [ts-strict.test.ts](../../tooling/contract-tests/ts-strict.test.ts) | Every `tsconfig*.json` must have `strict: true` (or inherit it) |
| `NO_CONSOLE_001` | No console in runtime | [no-console.test.ts](../../tooling/contract-tests/no-console.test.ts) | No `console.*` calls in `apps/` runtime code |
| `ARCH_LAYER_001` | No DB from routes | [arch-layer.test.ts](../../tooling/contract-tests/arch-layer.test.ts) | Route handlers must not import DB/repository modules directly |
| `CONTRACT_META_001` | Contracts meta | [contract-meta.test.ts](../../tooling/contract-tests/contract-meta.test.ts) | Exception files are valid, non-expired, and test files exist |

## Exception Mechanism

Each rule supports exceptions via JSON files in `/governance/exceptions/`:

```
governance/exceptions/
├── exception-schema.json          # JSON Schema for exception files
├── ts-strict.json                 # TS_STRICT_001 exceptions
├── no-console.json                # NO_CONSOLE_001 exceptions
└── arch-layer.json                # ARCH_LAYER_001 exceptions
```

### Exception Format

```json
{
  "ruleId": "RULE_ID",
  "description": "Human description",
  "entries": [
    {
      "path": "apps/my-app/**",
      "owner": "team-name",
      "justification": "Why this exception is needed",
      "expiresOn": "2026-09-01"
    }
  ]
}
```

**Every exception must have an expiry date.** Tests fail if any exception is expired — forcing teams to either fix the violation or explicitly renew the exception with updated justification.

## Violation Output

When a rule fails, the output includes:

- **Rule ID** — e.g. `TS_STRICT_001`
- **File path** — relative from repo root
- **Line number** (where applicable)
- **Offending value/snippet** — what was found
- **Remediation guidance** — suggested fix

Example:

```
[ARCH_LAYER_001] apps/web/app/api/users/route.ts:5
  Value: @nzila/db/schema (direct schema import)
  Snippet: import { users } from '@nzila/db/schema'
  Fix: Move DB call into a repository, call it from a service, then call the service from the route handler.
```

## CI Integration

Contract tests run as a required CI job (`Contract Tests (Architectural Invariants)`) in `.github/workflows/ci.yml`. The job:

1. Checks out the repo
2. Installs with `pnpm install --frozen-lockfile`
3. Runs `pnpm contract-tests`

This job must pass before merging.

## Adding a New Rule

1. Create `tooling/contract-tests/<rule-id>.test.ts`
2. Import helpers from `governance-helpers.ts`
3. (Optional) Create an exception file in `governance/exceptions/`
4. Add fixtures in `tooling/contract-tests/__fixtures__/`
5. Add unit tests in `governance-rules.unit.test.ts`
6. Update this document

## Architecture

```
tooling/contract-tests/
├── governance-helpers.ts           # Shared: file walking, exceptions, formatting
├── ts-strict.test.ts               # TS_STRICT_001
├── no-console.test.ts              # NO_CONSOLE_001
├── arch-layer.test.ts              # ARCH_LAYER_001
├── contract-meta.test.ts           # CONTRACT_META_001
├── governance-rules.unit.test.ts   # Unit tests for rule logic + fixtures
├── __fixtures__/                   # Test fixtures
│   ├── tsconfig-strict-false.json
│   ├── tsconfig-strict-true.json
│   ├── tsconfig-inherited.json
│   ├── route-with-console.ts
│   ├── route-clean.ts
│   ├── route-with-db-import.ts
│   ├── route-with-service.ts
│   ├── valid-exceptions.json
│   └── expired-exceptions.json
└── vitest.config.ts                # Vitest project config
```
