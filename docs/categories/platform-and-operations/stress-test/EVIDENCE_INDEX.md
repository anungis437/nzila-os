# Evidence Index — Enterprise Stress Test

**Date:** 2026-02-20  
**Commit:** `a505446` — main

---

## E01 — Toolchain Baseline

| ID | Type | Path / Command | Key Extract |
|----|------|----------------|-------------|
| E01-a | Local run output | `docs/stress-test/evidence/local-run-toolchain.txt` | `node: v24.13.1` / `pnpm: 10.11.0` |

---

## E02 — Pipeline Run (Contract Tests)

| ID | Type | Path / Command | Key Extract |
|----|------|----------------|-------------|
| E02-a | Local test run | `docs/stress-test/evidence/local-run-contract-tests.txt` | `Test Files 30 passed (30)` / `Tests 271 passed, 1 skipped (272)` |
| E02-b | CI workflow | `.github/workflows/ci.yml` | Jobs: lint-and-typecheck, test, build, ml-gates, ai-eval-gate, contract-tests, ops-pack-validation, schema-drift |

---

## E03 — DevSecOps Controls Inventory

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E03-a | Local inventory | `docs/stress-test/evidence/local-run-devsecops-inventory.txt` | Full workflow listing |
| E03-b | CI — Secret Scan | `.github/workflows/secret-scan.yml` | TruffleHog `--only-verified` + Gitleaks `gitleaks-action@v2` |
| E03-c | CI — CodeQL | `.github/workflows/codeql.yml` | `languages: [javascript-typescript, python]`, `queries: security-extended,security-and-quality` |
| E03-d | CI — Dependency Audit | `.github/workflows/dependency-audit.yml` | Daily schedule, `if CRITICAL > 0 → exit 1` |
| E03-e | CI — SBOM | `.github/workflows/sbom.yml` | `CycloneDX/gh-node-module-generatebom@v1`, `retention-days: 365` |
| E03-f | CI — Trivy | `.github/workflows/trivy.yml` | Container + filesystem, `exit-code: 1` on CRITICAL, SARIF to GitHub Security |
| E03-g | Pre-commit | `lefthook.yml` | `gitleaks: npx gitleaks@latest --staged`, lint-staged, typecheck-staged |
| E03-h | Pre-push | `lefthook.yml` | `contract-tests: npx vitest run …` |
| E03-i | Gitleaks rules | `.gitleaks.toml` | `nzila-clerk-secret-key`, `nzila-stripe-secret-key`, `nzila-stripe-webhook-secret`, `nzila-database-url-with-password`, `nzila-qbo-client-secret` |
| E03-j | Dependabot | `.github/dependabot.yml` | npm (weekly), github-actions (weekly), pip/automation (weekly) |

---

## E04 — Org Isolation (Phase 1)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E04-a | Auth engine | `packages/os-core/src/policy/authorize.ts` | `resolveRole(session)` reads `session.sessionClaims['nzila_role']`; `session.orgId` from auth session; `auth()` from `@nzila/platform-auth/entra/server` |
| E04-b | Entity access check | `packages/os-core/src/policy/authorize.ts` L145 `authorizeOrgAccess()` | `db.select().from(partnerEntities).where(eq(partnerId, ctx.partnerId) AND eq(orgId, orgId))` |
| E04-c | `org_members` schema | `packages/db/src/schema/orgs.ts` | `pgTable('org_members', { orgId, userId, role, status })` |
| E04-d | Contract test — auth in routes | `tooling/contract-tests/org-isolation.test.ts` L51 | `every route.ts calls an auth function` — 9/9 PASS |
| E04-e | Contract test — orgId not from body | `tooling/contract-tests/org-isolation.test.ts` L88 | `no route takes orgId directly from request body` — PASS |
| E04-f | Contract test — DB queries scoped | `tooling/contract-tests/org-isolation.test.ts` L108 | `route files with DB queries include an entity scope` — PASS |
| E04-g | Contract test — policy re-exports | `tooling/contract-tests/org-isolation.test.ts` L143 | `os-core policy re-exports authorize for uniform enforcement` — PASS |
| E04-h | **GAP** — No runtime HTTP cross-org tests | — | Cross-org READ/WRITE supertest scenarios do not exist |
| E04-i | Middleware — console | `apps/console/middleware.ts` | `authMiddleware(); !isPublicRoute → auth.protect()` |
| E04-j | Middleware — partners | `apps/partners/middleware.ts` | Same pattern; also covers `/invite(.*)` |

---

## E05 — AuthN/AuthZ (Phase 2)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E05-a | AuthZ contract test | `tooling/contract-tests/authz-regression.test.ts` | 7/7 tests pass |
| E05-b | AuthZ coverage test | `tooling/contract-tests/api-authz-coverage.test.ts` | 4/4 tests pass — every POST/PUT/PATCH/DELETE has auth check |
| E05-c | Role hierarchy | `packages/os-core/src/policy/roles.ts` L73 | `ROLE_HIERARCHY` — full DAG from `SUPER_ADMIN` → `VIEWER` |
| E05-d | Scope grants | `packages/os-core/src/policy/scopes.ts` L72 | `ROLE_DEFAULT_SCOPES` — all 20 roles mapped to fine-grained scopes |
| E05-e | `withAuth()` wrapper | `packages/os-core/src/policy/authorize.ts` L109 | Returns `NextResponse.json({ error }, 403)` on `AuthorizationError` |
| E05-f | **GAP** — Privilege escalation tests | — | No test: console:admin → super_admin-only route → 403 |

---

## E06 — Audit & Non-Repudiation (Phase 3)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E06-a | Hash chain implementation | `packages/os-core/src/hash.ts` | `computeEntryHash()` SHA-256 via `createHash('sha256')`, `verifyChain()` |
| E06-b | Audit schema | `packages/db/src/schema/operations.ts` L164 | `pgTable('audit_events', { hash: text.notNull(), previousHash: text, orgId: uuid.references(entities.id) })` |
| E06-c | Audit record insertion | `apps/console/lib/audit-db.ts` | imports `computeEntryHash`, queries prev hash, inserts with computed hash |
| E06-d | Chain verification function | `apps/console/lib/audit-db.ts` `verifyEntityAuditChain()` | Fetches ordered audit_events for entity, calls `verifyChain()` |
| E06-e | Audit action taxonomy | `apps/console/lib/audit-db.ts` `AUDIT_ACTIONS` const | 27 action types including `MEMBER_ROLE_CHANGE`, `EVIDENCE_PACK_SEAL`, governance lifecycle |
| E06-f | Immutability contract tests | `tooling/contract-tests/audit-immutability.test.ts` | 7/7 tests pass — no migration drops audit, no cascade delete |
| E06-g | Console backward compat | `apps/console/lib/audit.ts` | Re-exports `recordAuditEvent` from `audit-db`; legacy `auditLog()` deprecated |
| E06-h | Console audit unit tests | `apps/console/lib/audit.test.ts` + `apps/console/lib/__tests__/audit.test.ts` | 5+6=11 tests pass |
| E06-i | **GAP** — `DATA_EXPORT` action missing | — | No `DATA_EXPORT` or `DATA_EXPORT_REQUEST` in `AUDIT_ACTIONS` |
| E06-j | **GAP** — No `/verify-chain` API endpoint | — | `verifyEntityAuditChain()` exists as library function but no HTTP route |

---

## E07 — Secrets + Supply Chain (Phase 4)

*(Evidence covered under E03 — all ✅ PASS)*

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E07-a | Supply chain policy script | `tooling/security/supply-chain-policy.ts` | Called from `dependency-audit.yml` + `sbom.yml` |
| E07-b | Dockerfile present | `Dockerfile`, `apps/orchestrator-api/Dockerfile` | Multi-stage confirmed by Trivy `--target base` call |

---

## E08 — Runtime Safety (Phase 5)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E08-a | Rate limiting — orchestrator | `apps/orchestrator-api/src/index.ts` L34 | `@fastify/rate-limit` — `max: 200, timeWindow: '1 minute'`, 429 response builder |
| E08-b | Helmet — orchestrator | `apps/orchestrator-api/src/index.ts` L22 | `@fastify/helmet` with `hsts: { maxAge: 63072000 }`, `frameAncestors: 'none'` |
| E08-c | **GAP** — No rate limiting in Next.js apps | `apps/console/`, `apps/partners/`, `apps/web/` | grep for `rateLimit\|upstash\|arcjet` returned 0 results in app source |
| E08-d | Security headers — web | `apps/web/next.config.ts` | HSTS, X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff, CSP, Referrer-Policy, Permissions-Policy |
| E08-e | Security headers — console | `apps/console/next.config.ts` | HSTS, X-Frame-Options: DENY (stronger), CSP scoped to platform auth |

---

## E09 — Observability (Phase 6)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E09-a | Structured logger | `packages/os-core/src/telemetry/logger.ts` | `JSON.stringify(entry)` to stdout/stderr, `LogEntry` interface with level/message/timestamp/requestId/traceId/userId |
| E09-b | Request context | `packages/os-core/src/telemetry/requestContext.ts` | `AsyncLocalStorage<RequestContext>` with `requestId: randomUUID()`, `traceId` from W3C traceparent |
| E09-c | PII redaction | `packages/os-core/src/telemetry/logger.ts` L83 | `REDACT_KEYS = { password, email, secret, token, accesstoken, refreshtoken, idtoken, … }` + Bearer token regex |
| E09-d | OpenTelemetry bootstrap | `packages/os-core/src/telemetry/otel.ts` | `initOtel()` with `NodeSDK`, `OTLPTraceExporter`, auto-instrumentations |
| E09-e | Telemetry coverage tests | `tooling/contract-tests/telemetry-coverage.test.ts` | 12/12 tests pass |
| E09-f | Health route — orchestrator | `apps/orchestrator-api/src/routes/health.js` | Registered at app startup |
| E09-g | **GAP** — No health route in console/partners/web | — | `Get-ChildItem apps/ -Recurse -Filter "route.ts" \| Where-Object { $_.FullName -match "health" }` → empty |

---

## E10 — Release Discipline (Phase 7)

| ID | Type | Path | Key Extract |
|----|------|------|-------------|
| E10-a | Changeset config | `.changeset/config.json` | `access: "restricted"`, `baseBranch: "main"`, `updateInternalDependencies: "patch"` |
| E10-b | Release commands | `package.json` + Changesets CLI | `release: changeset publish`, `changeset version` |
| E10-c | Release workflow | `.github/workflows/release-train.yml` | Tag-triggered + dispatch (staging/production), pre-release-checks gate |
| E10-d | Frozen lockfile | All CI workflows | Every `pnpm install` uses `--frozen-lockfile` |
| E10-e | Node version pinned | All CI workflows | `node-version: 22` consistent |
| E10-f | Drizzle pin | `.github/dependabot.yml` | `drizzle-orm` major+minor blocked; `drizzle-kit` major blocked |
