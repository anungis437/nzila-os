# Package Ownership Matrix

This matrix summarizes package ownership expectations from `CODEOWNERS` and platform governance rules.

## Core Ownership Map

| Scope | Primary Owners | Secondary Owners | Notes |
|---|---|---|---|
| `packages/os-core/**` | `@nzila/platform` | `@nzila/eng`, `@nzila/security` | Core policy, evidence, and control logic |
| `packages/db/**` | `@nzila/platform` | `@nzila/security`, `@nzila/eng` | Schema/DAL/audit boundaries |
| `packages/platform-*/**` | `@nzila/platform` | `@nzila/eng` | Platform-authoritative surfaces |
| `packages/ai-core/**`, `packages/ai-sdk/**` | `@nzila/ai` | `@nzila/eng` | AI governance + consumption boundary |
| `packages/ml-core/**`, `packages/ml-sdk/**` | `@nzila/ml` | `@nzila/eng` | ML governance + consumption boundary |
| `packages/payments-stripe/**`, `packages/qbo/**` | `@nzila/platform` | `@nzila/security` | Financial and compliance sensitive |
| `packages/blob/**` | `@nzila/platform` | `@nzila/security` | Evidence/document storage boundary |
| `packages/enforcement/**`, `packages/governance/**`, `packages/audit/**` | `@nzila/platform` | `@nzila/security` | Governance and invariant enforcement |

## Domain Families (Suggested)

| Domain | Candidate Package Prefixes | Owning Team |
|---|---|---|
| Platform Core | `platform-*`, `os-core`, `db`, `enforcement`, `governance`, `audit` | Platform |
| Revenue & Finance | `platform-revenue`, `payments-*`, `finops`, `qbo`, `tax` | Platform + Security |
| AI/ML | `ai-*`, `ml-*`, `platform-ai-*`, `platform-agent-*` | AI/ML |
| Agriculture | `agri-*` | Agri Domain Team |
| Commerce | `commerce-*` | Platform + Commerce Domain |
| Zonga Domain | `zonga-*` | Zonga Domain Team |

## Ownership Review Process

1. For new package creation, add ownership intent to PR description.
2. For sensitive boundaries (auth, policy, db, audit), include `@nzila/security` review.
3. Keep `CODEOWNERS` as the source of truth; update this matrix when ownership shifts.

## Automation Hooks

- `pnpm package:ownership:check`
- `pnpm platform:authority:check`
- `pnpm platform:adoption:check`
