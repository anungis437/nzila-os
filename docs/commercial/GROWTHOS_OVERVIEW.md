# GrowthOS Overview

> **Package**: `@nzila/platform-growth-os` (v0.1.0)
> **Status**: Phase 1 — file-backed honest core. Drizzle schema declared but
> runtime IO is JSON-per-record under `ops/growth-{entity}/` so the package
> ships value before migrations land.

## What problem this solves

Before GrowthOS, Nzila's growth motion was scattered:

| Capability | Pre-GrowthOS location | Problem |
|---|---|---|
| Brand voice / messaging | Markdown in `docs/commercial/` | No machine enforcement |
| Audience segmentation | Implicit (per-app filters) | Not reusable across channels |
| Campaign orchestration | Manual / per-channel scripts | No state, no audit |
| Lead / deal scoring | None | No prioritisation signal |
| Multi-touch attribution | None | Can't prove what drove revenue |
| Proof capture (case studies, testimonials) | Ad-hoc | Easy to publish without permission |
| Founder narrative cadence | Memory | No reminder when a theme is overdue |
| Next-best-action | None | Operators guess |

GrowthOS unifies these into **one explainable, governed engine** — without
duplicating the systems that already exist (commerce quotes, partners, CRM
adapters, cognition engine, decision engine).

## What it composes (does NOT replace)

| Existing system | How GrowthOS uses it |
|---|---|
| `apps/partners/*` + `packages/db/src/schema/partners.ts` | Partner deals feed `attribution` events with `sourceKind='partner'` |
| `commerceQuotes` / `commerceContracts` | Quote pipeline rendered alongside campaign pipeline in the cockpit |
| `@nzila/crm-hubspot`, `apps/flow/lib/zoho` | External sources of truth — GrowthOS records reference their IDs, doesn't mirror them |
| `@nzila/platform-cognition-core` | Future: `ContextEnvelope.signals` could be derived from cognition tasks |
| `@nzila/platform-decision-engine` | Future: NBA recommendations could route through governed decisions |
| `@nzila/db` `pilotDefinitions` | Lead score `hasActivePilot` feature pulls from real pilots |

## Architecture (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│                     @nzila/platform-growth-os                │
├─────────────┬─────────────┬─────────────┬──────────┬────────┤
│  campaigns  │   scoring   │ attribution │  proof   │ founder│
├─────────────┴─────────────┴─────────────┴──────────┴────────┤
│            recommend (next-best-action rules engine)         │
├──────────────────────────────────────────────────────────────┤
│  store.ts (file-backed, zod-validated, scoped by tenant/org) │
├──────────────────────────────────────────────────────────────┤
│       schema.ts (Drizzle pgTables — Phase 2 migration)       │
└──────────────────────────────────────────────────────────────┘
```

Every public API:

1. Validates input via zod (`src/schemas.ts`).
2. Persists by writing one JSON file per record under `ops/growth-{entity}/`.
3. Returns the persisted record (same shape as the type) — **no out-of-band caches**.

Versioning is explicit:

- `GROWTH_OS_VERSION` (engine)
- `LEAD_SCORE_MODEL_VERSION = 'lead-logistic-v1'` (calibrated logistic)
- `NBA_VERSION = 'nba-rules-v1'` (deterministic rules)

When weights or rules change, the version bumps. Old records keep their
`modelVersion` so the rationale stays attributable.

## Honesty rules baked in

- **No ML training.** The lead-score weights are hand-calibrated from prior
  pilot outcomes, declared in `WEIGHTS` (see `src/scoring/lead-score.ts`).
  Confidence is a function of evidence count, not p-values.
- **No invented metrics.** The cockpit (`apps/console/app/(dashboard)/growth/page.tsx`)
  hides every section that has no records.
- **No silent publication.** `publishProof` refuses without permission +
  (case_study only) all KPIs observed.
- **No silent dispatch.** `startCampaignRun` refuses without an approved asset.

## Phase 2 (deferred)

- Move IO from `store.ts` to `@nzila/db` Postgres via `schema.ts`.
- Wire NBA into `@nzila/platform-decision-engine` for governance gates.
- Wire signal extraction into `@nzila/platform-cognition-core` envelopes.
- Add CRM bridge: HubSpot/Zoho contact IDs become `subjectId` directly.

Until then, growth-os is a **standalone honest core** — you can use it from
day one, and the migration will be mechanical when ready.

## Where to read next

- [docs/commercial/NZILA_INTERNAL_AGENCY_MODEL.md](./NZILA_INTERNAL_AGENCY_MODEL.md) — operating model
- [docs/runbooks/growthos-operator-runbook.md](../runbooks/growthos-operator-runbook.md) — daily/weekly use
- [docs/commercial/CHANNEL_STRATEGY_MAP.md](./CHANNEL_STRATEGY_MAP.md) — channel strategy
- [docs/commercial/NZILA_GROWTH_MOAT.md](./NZILA_GROWTH_MOAT.md) — commercial moat
- [packages/platform-growth-os/README.md](../../packages/platform-growth-os/README.md) — engineering quickstart
- [packages/platform-growth-os/STATUS.md](../../packages/platform-growth-os/STATUS.md) — what's shipped vs deferred
