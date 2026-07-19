# Nzila Console — Tab Schema

> Status: **v1 — Foundational**
> Companion docs: [Workspace Doctrine](./NZILA_CONSOLE_WORKSPACE_DOCTRINE.md) · [Telemetry Schema](./NZILA_CONSOLE_TELEMETRY_SCHEMA.md) · [Workspace Map](./NZILA_CONSOLE_WORKSPACE_MAP.md)

This document is the authoritative specification of every workspace, its sub-tabs, what
each sub-tab shows, and where the data comes from. The implementation under
`apps/console/app/(dashboard)/workspace` MUST match this schema. Sub-tabs are selected via
the `?tab=` query parameter so the surface stays server-rendered and deep-linkable.

---

## Navigation model

```
/workspace                      → redirects to /workspace/overview
/workspace/overview             (no sub-tabs)
/workspace/portfolio?tab=…      overview | ventures | pipeline | funding
/workspace/observatory?tab=…    cohorts | assessments | route-decisions | reassessments | benchmark-readiness
/workspace/sales?tab=…          leads | opportunities | proposals | pilots | conversions
/workspace/ventures?tab=…       (venture cards; each links to detail later)
/workspace/operations?tab=…     tasks | risks | decisions | governance | documentation
/workspace/settings             (no sub-tabs)
```

- Top tab bar = the six workspaces + Settings.
- Sub-tab bar = the `?tab=` segments within a workspace.
- Default sub-tab = the first listed; an absent or unknown `?tab=` falls back to it.

---

## Workspace 1 — Overview

**Question:** *Is the portfolio healthy this morning?*
No sub-tabs. The morning screen.

| Panel | Shows | Source |
| --- | --- | --- |
| Active ventures | Count of ventures not `frozen`/`cut` | product-catalog |
| Pipeline value | Sum of estimated value of active deals | deal-engine seed |
| Active pilots | Count of deals in pilot-category stages | deal-engine seed |
| Open opportunities | Count of deals in active (non-terminal) stages | deal-engine seed |
| Product maturity | Distribution of `code_presence` / `evidence_status` | product-catalog |
| Directive split | SELL NOW / BUILD NEXT / MAINTAIN / HOLD counts | product-catalog |
| Quick links | Jump into each workspace | static |

---

## Workspace 2 — Portfolio

**Question:** *What businesses exist, what stage are they in, what is healthy/blocked?*

### `?tab=overview` (default)
Portfolio health: active ventures, ARR/pipeline, active pilots, open opportunities,
product-maturity distribution, directive split.

### `?tab=ventures`
Cards for the strategic ventures (Union Eyes, TrustCore, Institutional Intelligence,
Health, Civic, Education) backed by underlying catalog products. Each card opens its own
venture surface.

### `?tab=pipeline`
Pulled from Deal Engine. Stage columns:
`Discovery → Qualified → Proposal → Pilot → Deployment → Expansion`
(mapped from canonical `DEAL_STAGES`).

### `?tab=funding`
Future grants and capital. Structural rows: IRAP · CanExport · Investors · Revenue.
Empty state in v1 (awaiting funding pipeline wiring).

---

## Workspace 3 — Observatory

**Question:** *What is the market-validation engine telling us?*
Schema-driven from migration 0031. Structural with honest empty states until cohort data
lands.

| Sub-tab | Shows | Source enum/table |
| --- | --- | --- |
| `?tab=cohorts` (default) | Organizations by sector / size band | `ii_observatory_organizations`, `ii_observatory_sector` |
| `?tab=assessments` | Maturity levels (level1–level5) | `ii_observatory_assessments`, `ii_observatory_maturity` |
| `?tab=route-decisions` | Route entry types | `ii_observatory_engagements`, `ii_observatory_route` |
| `?tab=reassessments` | Reassessment cadence and deltas | `ii_observatory_assessments` (time series) |
| `?tab=benchmark-readiness` | Dimension coverage & confidence | `ii_observatory_dimension_scores`, `ii_observatory_dimension`, `ii_observatory_confidence` |

Route enum: `iia_first · ue_first · hybrid_iia_ue · trustcore_route · defer`
Dimensions: `memory_integrity · continuity_capacity · governance_maturity ·
trust_operations · accountability_architecture · institutional_resilience`

---

## Workspace 4 — Sales

**Question:** *Where is revenue in the pipeline?*
Unified GTM — the place you open instead of HubSpot. Backed by `@nzila/deal-engine`.

| Sub-tab | Canonical stages mapped | Source |
| --- | --- | --- |
| `?tab=leads` (default) | `lead`, `qualified` | deal-engine |
| `?tab=opportunities` | `demo_scheduled`, `demo_completed` | deal-engine |
| `?tab=proposals` | `pilot_proposed` | deal-engine |
| `?tab=pilots` | `pilot_active`, `data_received`, `ingestion_running`, `pilot_review` | deal-engine |
| `?tab=conversions` | `converted`, `expanding` | deal-engine |

Each row: account, product, owner, estimated value, days in stage, conversion risk,
next action.

---

## Workspace 5 — Ventures

**Question:** *How mature is each venture, and what is blocking it?*
Portfolio view as venture cards. Strategic ventures shown:
`Union Eyes · TrustCore · Institutional Intelligence · Health · Civic · Education`.

Each card surfaces:

- **Maturity** — derived from `status` + `code_presence` + `evidence_status`
- **Roadmap** — directive (SELL NOW / BUILD NEXT / MAINTAIN / HOLD)
- **Revenue** — pipeline value attributed to the venture (deal-engine)
- **Customers** — active pilots / orgs (deal-engine)
- **Blockers** — explicit blocker notes (catalog / structural)

---

## Workspace 6 — Operations

**Question:** *What must the founder personally move this week?*
The founder cockpit. Console frames and links the existing `(dashboard)` routes; it does
not duplicate them.

| Sub-tab | Frames / links | Existing route |
| --- | --- | --- |
| `?tab=tasks` (default) | Initiatives & accountability | `/execution`, `/accountability` |
| `?tab=risks` | Risk register | `/risk` |
| `?tab=decisions` | Decision ledger & scoreback | `/audit`, `/decision-scoreback` |
| `?tab=governance` | Governance framework | `/governance`, `/board` |
| `?tab=documentation` | Internal docs | `/docs` |

---

## Workspace 7 — Settings

Account and workspace configuration. No sub-tabs in v1. Links to existing `/settings`.

---

## Invariants (tested / enforced)

1. Exactly six workspaces + Settings in the top tab bar.
2. Every `?tab=` value listed here resolves to a rendered panel; unknown values fall back
   to the default sub-tab.
3. No workspace renders fabricated metrics — unwired panels render an `EmptyState`.
4. Every workspace and sub-tab view emits a telemetry event (see Telemetry Schema).
