# Final Lock-In — Cora + Agrimo Shared Agri Platform

> Status: **Locked** — all enforcement gates active.

## What This Lock-In Covers

This document records the final enforcement pass that ensures the shared
Cora + Agrimo agri platform cannot drift, duplicate, or diverge.

Three conditions are enforced:

| Gate | Script | What It Checks |
|------|--------|----------------|
| AGRI-LOCK-001 | `scripts/agri-core-enforcement.ts` | No app-level redefinition of shared domain symbols (types, interfaces, const enums) or domain logic patterns |
| AGRI-LOCK-002 | `scripts/agri-duplication-report.ts` | Zero cross-app duplication of any symbol exported from the 8 shared agri packages |
| AGRI-LOCK-003 | `scripts/agri-reporting-schema-check.ts` | Canonical reporting schema parses valid payloads, rejects invalid ones |

All three are combined in `scripts/agri-final-lock-check.ts`.

## CI Workflows

| Workflow | Trigger | Gates |
|----------|---------|-------|
| `.github/workflows/agri-core-check.yml` | PRs touching `packages/agri-*`, `apps/cora/**`, `apps/agrimo/**`, enforcement scripts | LOCK-001, LOCK-002, LOCK-003 + agri package tests |
| `.github/workflows/agri-gov-ingestion-check.yml` | PRs touching `packages/agri-reporting/**`, `fixtures/agri/coragov/**` | LOCK-003 + ingestion contract tests |

## Shared Packages (8)

| Package | Purpose |
|---------|---------|
| `@nzila/agri-core` | Domain types, FSM, Zod schemas, service result envelope |
| `@nzila/agri-reporting` | Report engine, canonical schema, CoraGov ingestion contract |
| `@nzila/agri-provenance` | Provenance chain, hashing, verification |
| `@nzila/agri-forecasting` | Yield / price / risk forecasting models |
| `@nzila/agri-supply-chain` | Supply chain FSM, step types, event recording |
| `@nzila/agri-sync-contracts` | Cross-app sync contract types |
| `@nzila/agri-intelligence` | Analytics, yield efficiency, payout simulation |
| `@nzila/agri-traceability` | End-to-end product traceability |

Supporting packages: `@nzila/agri-events`, `@nzila/agri-adapters`, `@nzila/agri-db`.

## Allowlist

`ops/agri/agri-core-enforcement-allowlist.json` contains backward-compatibility
re-export files in `apps/agrimo/lib/agrimo-core/` that delegate to shared
packages. These are not redefinitions — they re-export from the canonical
source.

## Rules

1. **No new domain types** may be defined in `apps/cora/` or `apps/agrimo/` if
   the same symbol exists in a shared package.
2. **No domain logic reimplementation** — provenance, reporting, supply-chain,
   or intelligence functions must come from the shared package.
3. **One canonical reporting schema** — both apps emit reports through
   `canonicalReportSchema` with the shared `CANONICAL_SCHEMA_VERSION`.
4. **Extensions are namespaced** — app-specific data goes in
   `extensions.cora` or `extensions.agrimo`, never in the shared fields.
