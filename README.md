# Nzila OS

> A governed system platform — not a repository. Every product, every payment, every audit trail runs through one control plane with enforced invariants.

[![CI](https://github.com/anungis437/nzila-os/actions/workflows/ci.yml/badge.svg)](https://github.com/anungis437/nzila-os/actions/workflows/ci.yml)
[![Contract Tests](https://img.shields.io/badge/contract%20tests-380%2B%20passing-blue)](#system-guarantees)
[![GA Gates](https://img.shields.io/badge/GA%20gates-30%2F30-brightgreen)](#system-guarantees)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

---

## The System in 30 Seconds

Nzila OS is the operating system for Nzila Digital Ventures. It is a **governed platform** — not a collection of apps. Every business action flows through a single control plane with:

- **Enforced revenue pipeline** — all financial events pass through `@nzila/platform-revenue`. No app can process payments outside it.
- **Contract-enforced invariants** — 380+ contract tests enforce auth purity, revenue enforcement, control-plane authority, and platform drift prevention at CI time.
- **Evidence-first audit** — every material action produces a tamper-evident audit entry with a deterministic trace ID and hash-chain verification.
- **Org-scoped multi-tenancy** — every data query, API call, and evidence record is scoped to the authenticated organization.

For a deeper overview, see [docs/platform/what-is-nzila.md](docs/platform/what-is-nzila.md).

---

## Flagship Products

### UnionEyes

Union case management — grievance lifecycle, collective bargaining, elections, strike funds, evidence-sealed audit trails, federation management. Full-stack Next.js + Django. 3,000+ source files. Production-deployed.

### Zonga

Music distribution and streaming — artist management, royalties, content distribution, creator payouts, platform fees. Dedicated monetization layer (`zonga-monetization`, `zonga-economics`, `zonga-payments`). Production-deployed.

> **Flow** (commerce engine) and **CFO** (finance dashboard) are also production-deployed revenue verticals. Full classification: [portfolio-matrix.md](docs/platform/portfolio-matrix.md).

---

## Control Plane

The **Control Plane** (`apps/control-plane/`) is the system's governance hub — the default entry point for understanding and operating the platform.

| Capability | Description |
|------------|-------------|
| **System health** | Anomaly detection across all apps |
| **Revenue oversight** | Financial event aggregation via `@nzila/platform-revenue` |
| **Account governance** | Multi-tenant account management |
| **Agent orchestration** | Workflow coordination and dispatch |
| **Architecture compliance** | Drift monitoring and enforcement |

Every app is registered in the [platform-contracts registry](packages/platform-contracts/src/registry.ts). The control plane is the lens through which the entire system is observed and governed.

---

## Revenue Layer

`@nzila/platform-revenue` is the **mandatory** revenue pipeline. It is not optional.

- **REV-001–008**: Contract tests enforce that all revenue apps bind to the pipeline and no raw payment processing occurs outside allowlisted paths.
- **CTRL-009**: Financial-record emitters must depend on `@nzila/platform-revenue`.
- Every `emitRevenueEvent()` call auto-generates an auditable `RevenueAuditEntry` with a deterministic `traceId`.

Revenue apps: **Zonga** · **CFO** · **Flow** · **Partners** · **Trade**

---

## System Guarantees

| Invariant | Enforcement |
|-----------|-------------|
| **Unified auth** | All apps use `@nzila/platform-auth` — Argon2id + PG sessions, optional Entra SSO (AUTH-001–004) |
| **Revenue pipeline** | All financial events route through `@nzila/platform-revenue` (REV-001–008) |
| **Control-plane authority** | Every app registered, manifest-validated (CTRL-001–009) |
| **Org-scoped everything** | All queries, mutations, API routes scoped to `orgId` |
| **Evidence-first** | Material actions produce tamper-evident audit trails with hash chaining |
| **SDK-only AI/ML** | Apps use `@nzila/ai-sdk` / `@nzila/ml-sdk` — never provider SDKs directly |
| **Stack authority** | Django-authoritative apps (ABR, UnionEyes) must not mutate domain data via Drizzle |

**30 GA gates — all passing. 380+ contract tests enforced on every PR.**

---

## Products at a Glance

| Tier | Apps | Status |
|------|------|--------|
| **FLAGSHIP** | UnionEyes, Zonga, Flow, CFO | Production-deployed, revenue-generating |
| **CORE** | Console, Control Plane, Web, Orchestrator API | Deployed infrastructure |
| **Growth** | Partners, ABR, Agrimo, NACP Exams, Trade | Pilot or support stage |
| **INCUBATION** | Cora, Mobility, Mobility Client Portal, Platform Admin | Early-stage — not yet revenue-ready |

> All 17 apps are governed by the same invariants. Incubation apps are structurally identical — same auth, same evidence, same contract enforcement. Full breakdown: [portfolio-matrix.md](docs/platform/portfolio-matrix.md).

---

## Quick Start

```bash
pnpm install           # install all dependencies
pnpm dev               # run all apps in parallel
pnpm build             # build via Turborepo
pnpm test              # 7,669 unit tests (Vitest)
pnpm contract-tests    # 380+ invariant enforcement tests
```

**Prerequisites:** Node.js ≥ 20 · pnpm ≥ 10 · Python ≥ 3.11 (for Django backends). See `.env.example` in each app for auth config.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/platform/what-is-nzila.md](docs/platform/what-is-nzila.md) | 30-second platform overview |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full architectural overview |
| [docs/platform/portfolio-matrix.md](docs/platform/portfolio-matrix.md) | All 17 apps — tier, revenue readiness, strategic role |
| [docs/platform/revenue-architecture.md](docs/platform/revenue-architecture.md) | Revenue system design |
| [README.business.md](README.business.md) | Non-technical business overview |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guide + repo contract |
| [SECURITY.md](SECURITY.md) | Security posture and vulnerability reporting |

---

## License

Proprietary — Nzila Digital Ventures. All rights reserved.
