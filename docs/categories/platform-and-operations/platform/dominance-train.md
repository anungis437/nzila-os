# NzilaOS — Platform Dominance PR Train

> Ship the next share as an institutional platform, not "apps".

**Status**: In Progress  
**Created**: 2026-02-27  
**Owner**: Platform Engineering

---

## Objective

Implement four repo-wide multipliers as a single coordinated PR train:

| Multiplier | Description |
| ---------- | ----------- |
| **A** | Hard enforce read-only vs write boundaries (Cora + other insights surfaces) |
| **B** | Converge ABR to NzilaOS governance (org isolation, audit/evidence parity, integrations dispatcher-only) |
| **C** | Visible operational envelope in Console (performance + queues + outbox + integration SLOs) |
| **D** | Eliminate semantic drift in context naming (orgId/actorId/appId everywhere) |

## Non-Negotiables

- Strict TypeScript, layering: `route → service → domain → adapter`
- **org** terminology only (no "tenant", "company", "entity" as org synonym)
- Org isolation (RLS + org ctx) for every data access path
- Audited mutations for every write
- Evidence packs for terminal/irreversible events
- Integrations via `integrations-runtime` ONLY (no direct SDK usage in apps)
- Contract tests expanded to prevent regression
- Must pass: `pnpm -w lint`, `pnpm -w test`, `pnpm contract:test`, `turbo run build`

---

## Epic 0 — Audit Baseline + Changeset Plan

| PR | Scope | Status |
| -- | ----- | ------ |
| 0.1 | Create "Dominance Train" tracking docs | ✅ Done |

### Rollback

No code changes — docs only. Revert the commit.

---

## Epic 1 — Read-Only Enforcement (Cora + Insights Surfaces)

| PR | Scope | Status |
| -- | ----- | ------ |
| 1.1 | Contract tests: Cora must be read-only on ops tables | ✅ Done |
| 1.2 | Create explicit read-only query layer for intelligence apps | ✅ Done |

### Rollback

- 1.1: Remove contract test files. No production impact.
- 1.2: Revert Cora imports to previous agri-db barrel. Contract tests may fail — disable if reverting.

---

## Epic 2 — ABR Governance Convergence

| PR | Scope | Status |
| -- | ----- | ------ |
| 2.1 | ABR org isolation + auth parity enforcement | ✅ Done |
| 2.2 | ABR audit taxonomy parity with platform audit layer | ✅ Done |
| 2.3 | ABR evidence pack parity for terminal events | ✅ Done |
| 2.4 | ABR integrations dispatcher-only enforcement | ✅ Done |

### Rollback

- 2.1: Revert org-context middleware. Auth reverts to previous Clerk-only flow.
- 2.2: Remove `packages/audit/src/taxonomy/abr.ts`. Events stop emitting platform-form audit.
- 2.3: Remove evidence pack hooks. Terminal events proceed without evidence.
- 2.4: Revert to direct SDK calls. Integration delivery logs stop appearing in Console.

---

## Epic 3 — Console Operational Envelope

| PR | Scope | Status |
| -- | ----- | ------ |
| 3.1 | Platform performance metrics (p50/p95/p99, error rate, throughput) | ✅ Done |
| 3.2 | Queue/outbox visibility (worker + outbox lag) | ✅ Done |
| 3.3 | Integration SLO dashboard + proof pack inclusion | ✅ Done |

### Rollback

- Console pages are read-only. Revert page files. No data-layer impact.
- Platform-performance / platform-ops packages are additive — safe to unpublish.

---

## Epic 4 — Context Semantics Standardization

| PR | Scope | Status |
| -- | ----- | ------ |
| 4.1 | Introduce single canonical context contract (`packages/org`) | ✅ Done |
| 4.2 | Repo-wide refactor: replace `orgId` masquerading as `orgId` | ✅ Done |
| 4.3 | Contract tests: forbid ambiguous context field usage | ✅ Done |

### Rollback

- 4.1: Remove `packages/org`. Verticals revert to local context types.
- 4.2: Revert `orgId` → `orgId` renames. Must coordinate with 4.1 and 4.3.
- 4.3: Remove contract test. Regression prevention stops.

---

## Epic 5 — Tech Debt Signal Cleanup

| PR | Scope | Status |
| -- | ----- | ------ |
| 5.1 | Convert TODO/FIXME hotspots into tracked issues or eliminate | ✅ Done |

### Rollback

Cosmetic only. Revert commit.

---

## Final Validation Gates

```bash
pnpm -w lint
pnpm -w test
pnpm contract:test
turbo run build
```

All four must pass green before merge to `main`.

---

## Deliverables Summary

- [ ] Updated Console pages: performance, system health, integrations SLA
- [ ] ABR parity: org isolation + audit taxonomy + evidence packs + dispatcher-only integrations
- [ ] Cora read-only enforced by contract tests
- [ ] Canonical `OrgContext` with `orgId` everywhere
- [ ] Updated proof pack including ops + integrations snapshots
- [ ] No unscoped TODOs in security/governance code paths
