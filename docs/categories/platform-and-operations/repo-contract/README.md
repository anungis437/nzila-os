# Repo Contract

This document defines the **binding agreements** between packages, apps, and tooling in the nzila-automation monorepo. These contracts are enforced by code gates (lint rules, contract tests, and CI jobs) — not by intent or documentation alone.

## Golden Rules

1. **Evidence Generator SSoT** — All evidence pack business logic lives in `@nzila/os-core`. Callers are thin wrappers.
2. **No Shadow AI** — Apps must use `@nzila/ai-sdk`. Direct provider SDK imports are blocked by ESLint.
3. **No Shadow ML** — Apps must use `@nzila/ml-sdk`. Direct ML table reads are blocked.
4. **Entitlements First** — Partners app cannot access any entity without a `partner_entities` row.
5. **AuthZ on Every Route** — Every API route must call `authorize()` from `@nzila/os-core/policy`. Enforced by `api-authz-coverage.test.ts`.
6. **Evidence for Everything** — Every material action produces an evidence artifact in Blob + audit chain.
7. **Schema Changes = Migration** — No schema PR without a drizzle migration file. Enforced by `migration-policy.test.ts`.
8. **Version Bumps for Breaking Changes** — Package breaking changes require a semver bump + migration notes.

## Invariants

See [invariants.md](./invariants.md) for the full list with enforcement mechanisms.

## Packages and Their Contracts

| Package | Contract |
|---------|----------|
| `@nzila/os-core` | Single source of truth for evidence generation, policy/RBAC, telemetry, retention, config, secrets. |
| `@nzila/ai-sdk` | The ONLY way apps may call AI. Enforced by eslint-no-shadow-ai. |
| `@nzila/ml-sdk` | The ONLY way apps may read ML scores. Enforced by no-shadow-ml rule. |
| `@nzila/db` | Drizzle schema hub. All schema changes via migrations. |
| `@nzila/blob` | All file storage. No app-level Azure SDK calls. |

## App Contracts

| App | Must consume | Must NOT do |
|-----|-------------|-------------|
| `console` | `@nzila/ai-sdk`, `@nzila/ml-sdk`, os-core evidence, os-core policy | Direct AI/ML provider calls |
| `partners` | `@nzila/ai-sdk`, partner_entities entitlements | Direct entity access without entitlement check |
| `web` | Public-safe APIs only | Internal/restricted data |
| `union-eyes` | `@nzila/ai-sdk`, `@nzila/ml-sdk` | Shadow AI/ML |

## Versioning

See [versioning.md](./versioning.md).
