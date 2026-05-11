# Operator's Guide — Nzila OS

> If you are running, deploying, or maintaining Nzila OS day-to-day,
> start here.

---

## Quick Reference

| Task | Command / Link |
|------|---------------|
| Start all apps locally | `pnpm dev` |
| Run full test suite | `pnpm test` |
| Run architecture checks | `pnpm architecture:check` |
| Run governance checks | `pnpm governance:check` |
| Run platform adoption gate | `pnpm platform:adoption:check` |
| Deploy to staging | [gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) |
| Validate release | `pnpm validate:governance` |

---

## Application Inventory

| App | Domain | Port | Status |
|-----|--------|------|--------|
| union-eyes | Case management | 3000 | Production |
| flow | Commerce | 3007 | Production |
| web | Public marketing | 3001 | Production |
| cfo | Finance | 3003 | Production |
| partners | Partner portal | 3004 | Pilot |
| console | Internal ops | 3002 | Production |
| agrimo | Agri field ops | 3010 | Pilot |
| cora | Agri intelligence | 3011 | Pilot |
| trade | Cross-border trade | 3012 | Pilot |
| zonga | Mobility | 3013 | Pilot |
| abr | Audit & compliance | 3014 | Pilot |
| nacp-exams | Professional exams | 3015 | Pilot |
| mobility | Global mobility | 3016 | Pilot |
| mobility-client-portal | Client portal | 3017 | Pilot |
| control-plane | Platform admin | 3018 | Pilot |
| platform-admin | System admin | 3019 | Pilot |
| orchestrator-api | API gateway | 4000 | Pilot |

---

## Platform Architecture (operator view)

### The Four Mandates

Every governed app **must** adopt these four platform packages (enforced by CI):

1. **Shell** — `@nzila/platform-shell` (`NzilaAppShell`) provides auth, nav,
   org picker, and telemetry context. All internal apps share the same shell.

2. **Schema-core** — `@nzila/schema-core` provides Zod-based domain schemas
   (13 modules: currency, money, address, organization, user, contact, document,
   date-range, pagination, audit-event, evidence, domain-event, policy-result).

3. **Governed-workflow** — `@nzila/governed-workflow` provides the
   ingestion → FSM → evidence pipeline. Any workflow that produces audit-grade
   evidence must use this orchestrator.

4. **Observability** — `@nzila/os-core/telemetry` via `createAppBoot()` in
   `instrumentation.ts`. Canonical boot sequence: OpenTelemetry → metrics →
   env validation → boot invariants.

**Adoption gate**: `pnpm platform:adoption:check` — 60/60 checks passing.

### Exceptions

| App | Exemption | Reason |
|-----|-----------|--------|
| web | Shell | Public marketing site — own nav/footer |
| mobility-client-portal | Shell | External client portal — own branding |
| union-eyes | Shell, Observability | Django hybrid — custom patterns |
| orchestrator-api | Shell, Schema, Observability | Fastify (non-Next.js) |

---

## Deployment

### Staging (Azure Container Apps — Canada Central)

| Resource | Value |
|----------|-------|
| Resource Group | `nzila-canada-staging-rg` |
| ACR | `nzilacanadaacr.azurecr.io` |
| Environment | `nzila-canada-staging-env` |
| Domain | `jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| Database | `nzila-staging-db` (PostgreSQL Flexible) |
| Storage | `nzilacanadastore` (backups, documents, exports, media, evidence) |

Deploy via `gitops-deploy.yml` — builds 7 images, then `az containerapp update`.

### Auth

Dual auth model: email/password (Argon2id + PG sessions) is default; Entra SSO
is optional.

- Entra App: "Nzila OS Platform Auth"
- Session cookie: `nzila_session`
- Account lockout: 5 failed attempts → 15-minute lockout
- Auth resolution: PG session cookie → Entra/NextAuth JWT fallback

---

## Observability

| Layer | Package | Purpose |
|-------|---------|---------|
| OTel core | `@nzila/otel-core` | Spans, cost attribution, evidence correlation, SLO burn-rate |
| OS core telemetry | `@nzila/os-core/telemetry` | Request context, logger (PII redaction), metrics, env validation |
| Platform observability | `@nzila/platform-observability` | Correlation, alerting, health checks, reliability |
| Platform metrics | `@nzila/platform-metrics` | KPI aggregation |
| Platform RUM | `@nzila/platform-rum` | Web Vitals + OTel export |
| Observability | `@nzila/observability` | Full SDK (TraceContext, Span, TracedLogger, OTLP exporters) |

Boot sequence per app: `createAppBoot(appName, options?)` →
`initOtel` → `initMetrics` → `validateEnv` → `assertBootInvariants`.

---

## CI Gates

| Gate | Command | Blocks Deploy? |
|------|---------|---------------|
| Architecture layers | `pnpm architecture:layers:check` | Yes |
| Domain-core boundaries | `pnpm app:domain-core:check` | Yes |
| Platform surface model | `pnpm platform:surface:model:check` | Yes |
| Platform contracts | `pnpm platform:contract:check` | Yes |
| Registry consistency | `pnpm registry:consistency:check` | Yes |
| Control-plane coherence | `pnpm control-plane:coherence:check` | Yes |
| **Platform adoption** | `pnpm platform:adoption:check` | **Yes** |
| Governance gate | `pnpm validate:governance:gate` | Yes (fail-closed, no skip flags) |
| App gold standard | `pnpm app:gold-standard:check` | Warning (50% threshold) |
| Dependency boundaries | `pnpm deps:check` | Yes |

Composite: `pnpm architecture:check` runs all architecture gates in sequence.

---

## Runbooks

All operational runbooks live in `ops/runbooks/`:

| Category | Path |
|----------|------|
| Platform | `ops/runbooks/platform/` |
| Commerce | `ops/runbooks/commerce/` |
| Security | `ops/runbooks/security/` |
| Numbered (incident) | `ops/runbooks/numbered/` |

---

## Next Steps

| Goal | Link |
|------|------|
| Developer onboarding | [Golden Path](../GOLDEN_PATH_DEVELOPER_GUIDE.md) |
| Buyer's view | [01-buyer.md](01-buyer.md) |
| Auditor's view | [03-auditor.md](03-auditor.md) |
| Full architecture | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
