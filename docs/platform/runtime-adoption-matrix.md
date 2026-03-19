# NzilaOS — Runtime Adoption Matrix

> Tracks the enforcement pipeline adoption status for every app and
> every governance package. This is the single source of truth for
> understanding which parts of the platform are governed and which
> are not.
>
> **Last updated:** Auto-generated from codebase analysis.
> **Status:** Baseline — zero adoption detected.

---

## Adoption Summary

| Metric | Value |
|--------|-------|
| Total apps | 17 |
| Total server entrypoints | 1,382 |
| Entrypoints with enforcement pipeline | 0 |
| Entrypoints with governance checks | 0 |
| Entrypoints with audit trail | 0 |
| Entrypoints with observability | 0 |
| Entrypoints with security controls | 0 |
| **Overall enforcement adoption** | **0.0%** |
| **Target enforcement adoption** | **100% P0+P1, 80% P2** |

---

## Per-App Adoption Status

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully adopted — all qualifying routes wrapped |
| 🟡 | Partially adopted — some routes wrapped |
| ❌ | Not adopted — zero routes wrapped |
| ➖ | Not applicable — no qualifying routes |

---

### Enforcement Pipeline (`@nzila/enforcement`)

| App | Routes | P0 | P1 | Status | Notes |
|-----|--------|----|----|--------|-------|
| abr | 2 | 0 | 1 | ❌ | isolation-proof write needs enforcement |
| cfo | 8 | 2 | 3 | ❌ | Financial evidence — critical gap |
| console | 72 | 18 | 28 | ❌ | **Highest priority** — break-glass, AI, finance, audit |
| control-plane | 19 | 4 | 8 | ❌ | Agent execution, policy engine |
| cora | 1 | 0 | 0 | ➖ | Read-only app, P3 only |
| flow | 16 | 4 | 6 | ❌ | Webhooks, AI quotes |
| mobility | 1 | 0 | 0 | ➖ | Health only |
| mobility-client-portal | 1 | 0 | 0 | ➖ | Health only |
| nacp-exams | 3 | 0 | 1 | ❌ | Session writes |
| orchestrator-api | 7 | 2 | 3 | ❌ | **Fastify** — needs preHandler pattern |
| partners | 5 | 0 | 2 | ❌ | Deals, commissions |
| platform-admin | 1 | 0 | 0 | ➖ | Health only |
| pondu | 1 | 0 | 0 | ➖ | Health only |
| trade | 1 | 0 | 0 | ➖ | Health only |
| union-eyes | 1,235 | 142 | 486 | ❌ | **Largest gap** — 89.8% of total surface |
| web | 5 | 0 | 1 | ❌ | Governance status writes |
| zonga | 4 | 0 | 2 | ❌ | Catalog, revenue writes |

---

### Governance Checks (`@nzila/governance`)

Required for all P0 endpoints (172 total).

| App | P0 Routes | Governed | Status |
|-----|-----------|----------|--------|
| console | 18 | 0 | ❌ |
| control-plane | 4 | 0 | ❌ |
| flow | 4 | 0 | ❌ |
| orchestrator-api | 2 | 0 | ❌ |
| union-eyes | 142 | 0 | ❌ |
| Others | 2 | 0 | ❌ |
| **Total** | **172** | **0** | **0.0%** |

---

### Audit Trail (`@nzila/audit`)

Required for all P0+P1 endpoints (713 total).

| App | P0+P1 Routes | Audited | Status |
|-----|-------------|---------|--------|
| abr | 1 | 0 | ❌ |
| cfo | 5 | 0 | ❌ |
| console | 46 | 0 | ❌ |
| control-plane | 12 | 0 | ❌ |
| flow | 10 | 0 | ❌ |
| nacp-exams | 1 | 0 | ❌ |
| orchestrator-api | 5 | 0 | ❌ |
| partners | 2 | 0 | ❌ |
| union-eyes | 628 | 0 | ❌ |
| web | 1 | 0 | ❌ |
| zonga | 2 | 0 | ❌ |
| **Total** | **713** | **0** | **0.0%** |

---

### Observability (`@nzila/observability`)

Required for all endpoints (1,382 total).

| App | Total Routes | Traced | Status |
|-----|-------------|--------|--------|
| abr | 2 | 0 | ❌ |
| cfo | 8 | 0 | ❌ |
| console | 72 | 0 | ❌ |
| control-plane | 19 | 0 | ❌ |
| cora | 1 | 0 | ❌ |
| flow | 16 | 0 | ❌ |
| mobility | 1 | 0 | ❌ |
| mobility-client-portal | 1 | 0 | ❌ |
| nacp-exams | 3 | 0 | ❌ |
| orchestrator-api | 7 | 0 | ❌ |
| partners | 5 | 0 | ❌ |
| platform-admin | 1 | 0 | ❌ |
| pondu | 1 | 0 | ❌ |
| trade | 1 | 0 | ❌ |
| union-eyes | 1,235 | 0 | ❌ |
| web | 5 | 0 | ❌ |
| zonga | 4 | 0 | ❌ |
| **Total** | **1,382** | **0** | **0.0%** |

---

### Security Controls (`@nzila/security`)

Required for all P0+P1+P2 endpoints (1,165 total).

| App | Qualifying Routes | Secured | Status |
|-----|------------------|---------|--------|
| abr | 1 | 0 | ❌ |
| cfo | 7 | 0 | ❌ |
| console | 66 | 0 | ❌ |
| control-plane | 18 | 0 | ❌ |
| flow | 14 | 0 | ❌ |
| nacp-exams | 2 | 0 | ❌ |
| orchestrator-api | 6 | 0 | ❌ |
| partners | 4 | 0 | ❌ |
| union-eyes | 1,040 | 0 | ❌ |
| web | 4 | 0 | ❌ |
| zonga | 3 | 0 | ❌ |
| **Total** | **1,165** | **0** | **0.0%** |

---

### AI Control (`@nzila/ai-control`)

Required for all AI-related endpoints (~32 total).

| App | AI Routes | Controlled | Status |
|-----|-----------|-----------|--------|
| console | 14 | 0 | ❌ |
| control-plane | 2 | 0 | ❌ |
| flow | 1 | 0 | ❌ |
| union-eyes | 15 | 0 | ❌ |
| **Total** | **~32** | **0** | **0.0%** |

---

### Event Contracts (`@nzila/contracts` + `@nzila/events`)

Required for all event-emitting routes (~200 estimated).

| App | Event Routes (est.) | Contracted | Status |
|-----|-------------------|-----------|--------|
| console | 20 | 0 | ❌ |
| control-plane | 8 | 0 | ❌ |
| flow | 6 | 0 | ❌ |
| orchestrator-api | 5 | 0 | ❌ |
| union-eyes | 155 | 0 | ❌ |
| web | 2 | 0 | ❌ |
| zonga | 2 | 0 | ❌ |
| **Total** | **~198** | **0** | **0.0%** |

---

## Rollout Priority Order

Based on risk exposure (P0 density × route count):

| Priority | App | P0 | P1 | Total | Risk Score | Rationale |
|----------|-----|----|----|-------|------------|-----------|
| 1 | **union-eyes** | 142 | 486 | 1,235 | 🔴 Critical | 89.8% of surface, all domains |
| 2 | **console** | 18 | 28 | 72 | 🔴 Critical | AI, finance, break-glass, audit |
| 3 | **control-plane** | 4 | 8 | 19 | 🟠 High | Agent exec, policy engine |
| 4 | **flow** | 4 | 6 | 16 | 🟠 High | Webhooks, AI quotes |
| 5 | **orchestrator-api** | 2 | 3 | 7 | 🟠 High | Workflow commands, proof center |
| 6 | **cfo** | 2 | 3 | 8 | 🟡 Medium | Financial evidence |
| 7 | **partners** | 0 | 2 | 5 | 🟡 Medium | Commission writes |
| 8 | **web** | 0 | 1 | 5 | 🟡 Medium | Governance writes |
| 9 | **nacp-exams** | 0 | 1 | 3 | 🟢 Low | Exam sessions |
| 10 | **zonga** | 0 | 2 | 4 | 🟢 Low | Catalog writes |
| 11 | **abr** | 0 | 1 | 2 | 🟢 Low | Isolation proof |
| 12-17 | Health-only apps | 0 | 0 | 6 | ⚪ None | cora, mobility, mobility-client-portal, platform-admin, pondu, trade |

---

## Enforcement Milestones

| Milestone | Target | Scope | Status |
|-----------|--------|-------|--------|
| M0: Baseline | — | Inventory complete | ✅ This document |
| M1: Critical path | All P0 endpoints | 172 routes in 5 apps | ❌ Not started |
| M2: High-risk | All P0+P1 endpoints | 713 routes in 11 apps | ❌ Not started |
| M3: Broad coverage | All P0+P1+P2 | 1,165 routes in 14 apps | ❌ Not started |
| M4: Full coverage | All endpoints | 1,382 routes in 17 apps | ❌ Not started |

---

## Validation

This matrix is validated by `governance/runtime-adoption-matrix.json` which
contains the machine-parseable version of all data above. CI will track
adoption percentage and fail if it regresses.
