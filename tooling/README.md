# Tooling

> Development tooling, CI enforcement, security checks, and governance gates for the Nzila OS monorepo.

## Directories

### CI & Automation

| Directory | Purpose |
|-----------|---------|
| `contract-tests/` | 150+ architectural contract tests — governance, security, org isolation, API surface |
| `chaos/` | Chaos engineering test framework |
| `env/` | Environment variable parity check |
| `golden-path/` | Golden-path app scaffolding |
| `openapi-gen/` | OpenAPI spec generation |
| `ops/` | DR restore simulation, ops pack validation |
| `test-data/` | Synthetic test data generation |
| `backstage/` | Backstage developer portal configuration |

### Security

| Directory | Purpose |
|-----------|---------|
| `security/` | Supply chain policy, compliance scorecard, MTTR dashboard, requirements traceability |
| `threat-modeling/` | OWASP Threat Dragon configuration |

### Analysis

| Directory | Purpose |
|-----------|---------|
| `ai-evals/` | AI evaluation harnesses, RAG ingestion, eval datasets |
| `db/` | Database schema snapshots, ORM parity checks, preflight validation |
| `ml/` | ML model training & inference (anomaly detection, case priority, SLA breach risk) |
| `validation/` | Architecture audit, claim verification, doc consistency, package audit |

### Governance

| Directory | Purpose |
|-----------|---------|
| `governance/` | Control manifest validation, governance gate checks |
| `ga-check/` | General availability gate checker |
| `staging-certification/` | 18-phase staging certification suite (auth, financial, workflow, observability) |

### Utility

| Directory | Purpose |
|-----------|---------|
| `scripts/` | Miscellaneous scripts (auth guard fix, evidence index generation) |

## Top-level Files

| File | Purpose |
|------|---------|
| `build-env-check.ts` | Build environment validation |
| `security-headers-check.ts` | Security headers enforcement |
| `tsconfig.json` | TypeScript config for tooling scripts |
