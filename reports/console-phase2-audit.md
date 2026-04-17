# Console Phase 2 Audit

Date: 2026-04-17

## Objective

Upgrade Console from a strong Business OS dashboard into a weekly decision machine focused on three gaps:

1. Founder focus visibility
2. True runway visibility
3. Weekly CEO decision briefing

## What Data Already Exists

Reusable live data already in the monorepo:

- `platformCostRollups`: live 30-day platform burn by app and category
- `platformCostBudgetBreaches`: budget pressure / cost breach events
- `pilotDefinitions`: venture-level pilot status by `appScope`
- `commerceQuotes`: live commercial pipeline volume and age
- `commerceInvoices`: receivables and aging inputs
- `zongaRevenueEvents`: live realized revenue source already in production schema
- `approvals`: governance friction / execution backlog
- `auditEvents`: cadence and activity freshness
- `orgs`: executive root entity selection for new manual-input tables
- `product-catalog.json`: venture priority, delivery confidence, evidence posture, and strategic importance

## Schemas Reused

Phase 2 deliberately reuses:

- `platform.ts` for burn and cost intensity
- `pilot-metrics.ts` for venture momentum
- `commerce.ts` for pipeline + receivables
- `governance.ts` for approval drag
- `zonga.ts` for live revenue traction
- `orgs.ts` for executive org scoping

## New Schema Surface Added

New tables added in `packages/db/src/schema/executive.ts`:

- `founder_time_logs`
- `weekly_focus_targets`
- `treasury_snapshots`
- `runway_assumptions`

These are intentionally minimal. They fill the two missing input classes that did not exist anywhere in the current platform:

- founder effort allocation
- treasury reality / runway assumptions

## Pages Extended Vs New

Extended existing pages:

- `Today`: now includes runway, founder focus warning, weekly decisions, ranking shifts, and a one-sentence weekly directive
- `Portfolio`: now uses a live capital-priority score instead of static catalog ordering alone

New pages:

- `Focus`: founder effort allocation + leakage + weekly recommendations
- `Runway`: cash, working capital, runway scenarios, aging, hiring affordability
- `Briefing`: weekly CEO summary with decisions, rising risks, and suggested time/spend allocation

## Static Data Still Needing DB Upgrade

Still static after this pass:

- `execution/page.tsx` weekly initiatives array
- parts of venture-level revenue attribution outside Zonga
- Monday briefing delivery itself (page exists; scheduled digest does not)

Manual-input systems added in this pass because live integrations were absent:

- founder time logs
- weekly focus targets
- treasury snapshots
- runway assumptions

## Existing Formulas Usable Now

Existing logic reused directly:

- ops confidence via `computeOpsScore()`
- cost pressure via 30-day rollups and breaches
- commercial urgency via quote aging + pilot activity
- delivery confidence via catalog `code_presence` + `evidence_status`
- strategic value via catalog `commercial_priority`

## Missing Integrations

Highest-value gaps still blocking full “operator-grade truth”:

1. Venture attribution on `commerceQuotes` and `commerceInvoices`
2. Live bank / treasury sync for cash balances
3. Payroll / contractor / SaaS subscription feeds as direct burn inputs
4. Automated Monday briefing delivery (email / Slack / PDF)
5. Collections workflow tied to overdue receivables

## Quickest Path To Live Utility

The fastest route was not a redesign.

It was:

1. Reuse live cost, pilot, quote, invoice, approval, and revenue tables
2. Add only the two missing manual systems: founder time and treasury snapshots
3. Centralize all decision logic in one shared executive-intelligence layer
4. Extend Today and Portfolio so the new intelligence affects Monday workflow immediately

## Conclusion

Phase 2 did not need a broad architecture rewrite.

The highest ROI move was a thin executive data layer on top of existing operational truth, plus small new manual-input tables where the platform had no source of record yet.