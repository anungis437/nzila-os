# Hardening Baseline Report

**Date**: 2026-02-20
**Branch**: `main` (commit at time of audit)
**Node**: v24.13.1 | **pnpm**: 10.11.0 | **Turbo**: ^2.4.4

---

## 1. Repo Inventory

### Apps

| App | Port | Framework | Auth | Org Boundary | Critical? |
|-----|------|-----------|------|--------------|-----------|
| `@nzila/web` | 3000 | Next.js 16 | None (public) | N/A | Low |
| `@nzila/console` | 3001 | Next.js 16 | Clerk | `authorize()` + entity-scoped | **High** |
| `@nzila/partners` | 3002 | Next.js 16 | Clerk | `authorize()` + entity-scoped | **High** |
| `@nzila/union-eyes` | 3003 | Next.js 16 | Clerk (optional) | `entityId` via URL param ⚠️ | **High** |
| `@nzila/orchestrator-api` | 4000 | Fastify 5 | Env-scoped tokens | N/A (CI-triggered) | Medium |

### Packages

| Package | Purpose | Security-Relevant |
|---------|---------|-------------------|
| `@nzila/os-core` | Platform core: policy, telemetry, evidence, hash chain, env validation | **Yes** — `authorize()`, audit hash, env validation |
| `@nzila/db` | Drizzle ORM schema, client, migrations | **Yes** — schema defines `audit_events`, entity membership |
| `@nzila/ai-core` | AI gateway, budget enforcement, tool integration | Yes — action attestation, budget |
| `@nzila/ai-sdk` | Thin AI SDK + lint rule | Low |
| `@nzila/ml-core` | ML model registry, evidence | Yes — evidence collector |
| `@nzila/ml-sdk` | Thin ML SDK + lint rule | Low |
| `@nzila/payments-stripe` | Stripe client, webhooks, normalization | **Yes** — financial data |
| `@nzila/qbo` | QuickBooks Online OAuth | **Yes** — OAuth tokens |
| `@nzila/blob` | Azure Blob Storage abstraction | Yes — evidence storage |
| `@nzila/tax` | Tax deadlines, validation, governance | Yes — regulatory |
| `@nzila/tools-runtime` | AI tool execution sandbox | Yes — arbitrary tool execution |
| `@nzila/ui` | Shared React components | Low |
| `@nzila/config` | Shared tsconfig, eslint, prettier | Low |
| `@nzila/analytics` | Placeholder (empty) | — |
| `nzila-scripts-book-template` | Repo scaffolding CLI | Low |

---

## 2. CI/CD Pipelines

| Workflow | File | Trigger | Status |
|----------|------|---------|--------|
| CI | `.github/workflows/ci.yml` | push/PR → main | ✅ Active — lint, typecheck, test, build, ML gates, contract tests, ops validation, schema drift |
| Secret Scan | `.github/workflows/secret-scan.yml` | push/PR → main | ✅ Active — TruffleHog + Gitleaks |
| Dependency Audit | `.github/workflows/dependency-audit.yml` | PR (package changes) + daily cron | ✅ Active — `pnpm audit --audit-level=high`, fails on critical |
| SBOM | `.github/workflows/sbom.yml` | push → main + releases | ✅ Active — CycloneDX |
| CodeQL | `.github/workflows/codeql.yml` | push/PR + weekly cron | ✅ Active — JS/TS + Python |
| Deploy (web/console/partners) | `.github/workflows/deploy-*.yml` | push → main (path-filtered) | ✅ Active — Docker → ACR → Azure Container Apps |
| Control Tests | `.github/workflows/control-tests.yml` | Scheduled + manual | ✅ Active — SOC 2 (CT-01 through CT-10) |
| Ops Pack | `.github/workflows/ops-pack.yml` | push/PR (ops/ paths) + weekly | ✅ Active |
| Release Train | `.github/workflows/release-train.yml` | tag push `v*` + manual | ✅ Active — 4-gate release |
| Playbook Runner | `.github/workflows/nzila-playbook-runner.yml` | `workflow_dispatch` | ✅ Active |

### CI enforces:
- `--frozen-lockfile` on install
- lint + typecheck as required jobs
- contract tests as required job
- ML gates (Python syntax + schema validation)

---

## 3. Existing Security Policies & Documentation

| Document | Path | Summary |
|----------|------|---------|
| SECURITY.md | `/SECURITY.md` | Vuln reporting, supply chain, access control, audit trail |
| CODEOWNERS | `/CODEOWNERS` | `@nzila/security` on payments, qbo, workflows; `@nzila/platform` on CI, os-core, db schema |
| Threat Model | `/governance/security/THREAT_MODEL.md` | STRIDE analysis (29 threats, 27 mitigated, 2 partial) |
| Incident Response | `/ops/incident-response/README.md` | P1–P4 severity, full lifecycle |
| IR Runbook | `/ops/incident-response/runbooks/ir-001-standard-incident-response.yaml` | Standard IR playbook |
| Security Ops | `/ops/security-operations/README.md` | Access management, key rotation, vuln scanning |
| Supply Chain Policy | `/tooling/security/supply-chain-policy.ts` | Vulnerability waiver enforcement |
| Compliance | `/ops/compliance/` | SOC 2 Type I controls |

---

## 4. Current Test Strategy

### Unit Tests
- Framework: **Vitest ^4.0.18** (workspace-wide)
- Configs in: `apps/web`, `apps/console`, `apps/partners`, `packages/ui`, `packages/ai-core`, `packages/ai-sdk`, `packages/ml-sdk`, `packages/payments-stripe`, `packages/qbo`, `packages/tools-runtime`
- CI job: `pnpm test` via Turbo

### Contract Tests (Architectural Enforcement)
- Location: `tooling/contract-tests/`
- 10+ test suites enforcing repo invariants:
  - `invariants.test.ts` — no shadow AI/ML imports, evidence generators in os-core, `authorize()` on routes
  - `api-authz-coverage.test.ts` — every mutating route has auth
  - `api-contracts.test.ts` — `/api/health` exists in each app
  - `env-contract.test.ts` — Zod-validated env, no hardcoded secrets
  - `evidence-seal.test.ts` — cryptographic evidence seal
  - `telemetry-coverage.test.ts` — telemetry setup
  - `sdk-contracts.test.ts` — SDK contracts
  - `alerting-integrity.test.ts`, `migration-policy.test.ts`, `no-duplicate-evidence-generator.test.ts`

### E2E Tests
- **None** — no Playwright or Cypress setup detected

### Python Tests
- ML scripts under `tooling/ml/` — validated via CI Python syntax check
- `packages/automation/` — pytest (task defined in VS Code)

---

## 5. TypeScript & Lint Enforcement

### TypeScript
- **`strict: true`** ✅ enforced via `packages/config/tsconfig.base.json`
- Target: ES2022, Module: ESNext, `isolatedModules: true`, `forceConsistentCasingInFileNames: true`
- All apps/packages extend the base config

### ESLint
- Apps use `eslint-config-next/core-web-vitals` + `typescript`
- Custom rules enforced:
  - `noShadowAi` — prevents direct AI provider imports in apps
  - `noShadowMl` — prevents direct ML table reads in apps
- CI runs `pnpm lint` as required check

### Prettier
- `format:check` available; not confirmed as CI-required step

---

## 6. Org Boundary (Org Isolation)

### Current Mechanism
- **Application-layer isolation** via `authorize()` from `@nzila/os-core/policy`
- `entity_members` table gates user → entity access (roles: admin, editor, viewer)
- `partner_entities` gates partner → entity relationships
- Every API route must call `authorize()` (enforced by `api-authz-coverage.test.ts`)

### Known Issues
- **No database-level RLS** — all isolation is application-layer
- Union Eyes passes `entityId` as URL parameter — code comment says "in production, derive from session instead" ⚠️
- No dedicated cross-org boundary tests (only auth coverage tests)
- Error messages not audited for org enumeration leakage

---

## 7. Known Gaps — Risk Register

| # | Risk | Impact | Likelihood | Gap | Mitigation PR |
|---|------|--------|------------|-----|---------------|
| R-01 | No pre-commit hooks | Secrets committed before CI catches them | Medium | No Husky/Lefthook | PR 1 |
| R-02 | No CSP headers | XSS attacks, data exfiltration | High | Missing `Content-Security-Policy` on all apps | PR 6 |
| R-03 | No HSTS header | Downgrade attacks | Medium | Missing `Strict-Transport-Security` | PR 6 |
| R-04 | No API rate limiting | DoS, abuse, cost amplification | High | No `@fastify/rate-limit` or equivalent | PR 7 |
| R-05 | Container images not pinned to digest | Supply chain compromise | Medium | Dockerfile uses `node:22-alpine` tag, not digest | PR 3 |
| R-06 | No Dependabot/Renovate | Stale dependencies, unpatched CVEs | Medium | No automated dependency update PRs | PR 2 |
| R-07 | No Trivy container scanning | Vulnerable base images ship to prod | Medium | Only CycloneDX SBOM, no container scan | PR 3 |
| R-08 | No cross-org boundary tests | Org data leakage | **Critical** | No explicit cross-org read/write failure tests | PR 9 |
| R-09 | Union Eyes `entityId` from URL | Org enumeration / spoofing | High | Should derive from session | PR 9 |
| R-10 | No orchestrator security headers | Clickjacking, MIME sniffing on API | Low | Missing `@fastify/helmet` | PR 6 |
| R-11 | No structured logging standard | PII in logs, no correlation | Medium | Logger exists but no redaction/correlation enforcement | PR 11 |
| R-12 | No E2E tests | Critical flows untested end-to-end | Medium | No Playwright setup | PR 15 |
| R-13 | Audit immutability not enforced in DB | Audit tampering | Medium | No DB constraints preventing UPDATE/DELETE on audit_events | PR 10 |
| R-14 | No release automation (changesets) | Inconsistent versioning | Low | Manual releases only | PR 18 |
| R-15 | Prettier not in CI | Inconsistent formatting | Low | `format:check` exists but not required | PR 5 |

---

## 8. What's Already in Good Shape

These areas do **not** need new PRs (or need only minor enhancement):

| Area | Evidence |
|------|----------|
| Secret scanning (CI) | `secret-scan.yml` — TruffleHog + Gitleaks on every push/PR |
| SAST (CI) | `codeql.yml` — CodeQL for JS/TS + Python |
| Dependency audit (CI) | `dependency-audit.yml` — daily + PR, fails on critical |
| SBOM generation | `sbom.yml` — CycloneDX on push + release |
| Frozen lockfile in CI | All CI jobs use `--frozen-lockfile` |
| TypeScript strict mode | `strict: true` in shared base tsconfig |
| Auth on routes | `authorize()` enforced by contract test |
| Health endpoints | All 5 services have `/health` or `/api/health` (contract-tested) |
| Audit hash chain | `audit_events` with SHA-256 chain, `verifyChain()` |
| Env validation (Zod) | `@nzila/os-core/config/env` with per-app schemas |
| OTel baseline | `@nzila/os-core/telemetry/otel` with OTLP exporter |
| CODEOWNERS | Security-sensitive paths require `@nzila/security` review |
| Incident response | Documented IR playbook with severity levels |
| SOC 2 controls | Control tests automated in CI |

---

## 9. PR Triage — What to Skip vs. Implement

| Planned PR | Status | Action |
|------------|--------|--------|
| PR 1: Secret Scanning + Pre-commit | **Partially done** (CI exists, no pre-commit) | Implement: add pre-commit hooks + docs |
| PR 2: SAST + Dependency Scanning | **Mostly done** (CodeQL + dep audit exist) | Implement: add Dependabot config |
| PR 3: SBOM + Container Scanning | **Partially done** (SBOM exists, no Trivy) | Implement: Trivy + image pinning |
| PR 4: Build Reproducibility | **Mostly done** (frozen lockfile, Turbo) | Implement: policy doc + required checks naming |
| PR 5: Security Baselines | **Partially done** (SECURITY.md exists) | Implement: enhance SECURITY.md + CODEOWNERS for auth paths |
| PR 6: Security Headers + CSP | **Partially done** (SWA headers, no CSP/HSTS) | **Implement**: CSP, HSTS, Next.js headers |
| PR 7: Rate Limiting | **Gap** | **Implement** |
| PR 8: AuthN/AuthZ Guardrails | **Partially done** (Clerk + authorize exist) | Implement: regression tests |
| PR 9: Org Isolation Proof | **Gap** | **Implement** (Critical) |
| PR 10: Audit Logging Immutability | **Partially done** (hash chain exists) | Implement: DB constraints + tests |
| PR 11: Structured Logging | **Partially done** (logger exists) | Implement: redaction + correlation |
| PR 12: OpenTelemetry Baseline | **Partially done** (OTel init exists) | Implement: trace propagation docs |
| PR 13: Health Checks | **Done** (contract-tested) | **Skip** — already enforced |
| PR 14: Runbooks | **Partially done** (IR exists) | Implement: additional scenario runbooks |
| PR 15: Coverage Gates | **Gap** (no coverage thresholds) | Implement |
| PR 16: API Schema Contracts | **Partially done** (Zod exists) | Implement: invalid payload tests |
| PR 17: Configuration Hardening | **Done** (Zod env validation, contract-tested) | **Skip** — already enforced |
| PR 18: Release & Change Management | **Partially done** (release-train exists) | Implement: changesets |

---

## 10. Local Verification Commands

```bash
# Install
pnpm install

# Full CI equivalent
pnpm turbo run lint typecheck test build

# Contract tests
pnpm contract-tests

# Format check
pnpm format:check
```

---

*Generated as part of the Nzila Hardening Pass — Phase 0*
