# Nzila OS — Platform Summary (Buyer-Safe)

> Version: 2026-03-14 | Grade: A- | Status: Production-grade

---

## What Nzila OS Is

Nzila OS is a multi-vertical platform operating system built on Next.js, Fastify, and PostgreSQL. It powers regulated workflows across financial services, trade, agriculture, mobility, and governance verticals — with a shared core of authentication, audit, evidence, and policy enforcement.

---

## Platform Composition

| Layer | Components | Maturity |
|-------|-----------|----------|
| **Applications** | 16 apps (web, console, partners, union-eyes, ABR, CFO, trade, mobility, and 8 others) | Production: 4 apps actively deployed; others in beta/alpha |
| **Core Platform** | 97+ packages (os-core, db, platform-validation, integrations-runtime, etc.) | Stable; versioned; contract-tested |
| **Infrastructure** | Docker, Azure Container Apps, PostgreSQL, Clerk auth, Blob storage | Staging deployed and healthy |
| **Automation** | Orchestrator API (Fastify), 5 playbooks, hash-chained audit trail | Operational with dry-run + approval gates |

---

## Security & Governance Posture

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication | Clerk OIDC + middleware on all apps | GA gate check PASS |
| Authorization | Role-based + policy engine + zero-trust | 23/23 governance checks |
| Org isolation | Scoped DB access; no raw DB in app code | Contract tests + ESLint rules |
| Audit trail | Hash-chained, append-only, DB-immutable | SQL triggers prevent UPDATE/DELETE |
| Evidence sealing | SHA-256 + HMAC + Merkle root | Verification endpoint available |
| Secret scanning | TruffleHog + Gitleaks in pre-commit + CI | Automated; blocks on detection |
| Dependency audit | Daily pnpm audit + waiver policy | Zero critical vulnerabilities |
| Container scanning | Trivy weekly; blocks on CRITICAL | .trivyignore for known FPs |

**GA Gate: 23/23 checks passing.** No bypass flags. No skip options.

---

## Quality Metrics

| Metric | Value |
|--------|-------|
| Contract tests | 130+ structural invariants |
| Unit tests | 350+ across platform packages |
| Test coverage | All platform packages covered; 2 app-level gaps |
| CI pipeline | lint → typecheck → test → governance gates → build |
| Release gates | contract-tests + validate:release:strict + ga-check + AI eval gate |

---

## Integration Architecture

| Capability | Implementation |
|------------|---------------|
| Retry | Exponential backoff with jitter (1s → 30s, max 3 attempts) |
| Circuit breaker | Org+provider scoped, persistent, 5-failure threshold |
| Resilient dispatch | ResilientDispatcher composes retry + circuit breaker |
| Dead letter queue | Failed deliveries persisted with full audit trail |
| Rate limiting | Provider-specific 429 parsers (Slack, HubSpot, Teams) |
| Health monitoring | Per-provider health aggregation with SLO tracking |

---

## What This Platform Does NOT Yet Have

Transparency is a feature. These items are known, tracked, and prioritized:

| Gap | Context |
|-----|---------|
| Full test suites for ABR and CFO apps | Verticals with >80% server-rendered UI; action tests planned |
| OPA runtime policy evaluation | OPA rules exist for CI; runtime uses equivalent policy engine |
| Key rotation monitoring | Required by fintech profile; operational tooling pending |
| Audit event query API | Audit data is stored and hash-chained; no admin query endpoint yet |
| Production deployment automation | Staging automated; production requires manual `az containerapp update` |

---

## Deployment Topology

- **Staging**: Azure Container Apps (East US) — 4 apps running, HTTP 200
- **Registry**: Azure Container Registry (nzilastagingacr.azurecr.io)
- **Storage**: Azure Blob (backups, documents, exports, media, evidence)
- **Production**: Target architecture defined; deployment pending customer commitment

---

## Conclusion

Nzila OS is a **production-grade platform with strong governance foundations**. Its security posture (23/23 mandatory checks, hash-chained audit, zero-trust auth) and structural enforcement (130+ contract tests, CI governance gates, immutable controls) are appropriate for regulated verticals. The known gaps are operational — not architectural — and are tracked in the platform roadmap.
