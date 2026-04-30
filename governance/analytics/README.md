# Analytics Operating Model

**Owner:** Platform Lead (with Product Leads) · **Last update:** 2026-04-28
**Source bundle:** Info-Tech *Establish an Analytics Operating Model* +
*Build a Reporting and Analytical Insights Strategy* +
*Build a Data Integration Strategy*.

## 1. Why this domain exists

Nzila already has analytics surfaces (Console KPIs, CFO dashboards,
Union-Eyes case analytics, Flow operational metrics). This document
captures the **operating model** — how analytics work is organized,
prioritized, governed, and delivered — distinct from the AI/ML
operating model in [`governance/ai/`](../ai/).

## 2. Operating model summary

| Dimension | Choice (Nzila) | Notes |
|-----------|----------------|-------|
| **Org pattern** | **Hub-and-spoke (federated)** | Central Platform team owns shared infra, semantic layer, governance; per-vertical squads own product-specific dashboards and KPIs |
| **Funding** | Per-vertical product budget | Platform team funded as platform tax |
| **Tooling stance** | Bring-your-own-frontend on a shared semantic layer | Today: app-embedded; medium term: candidate for a dedicated BI tool |
| **Sourcing** | In-house | No outsourced analytics |
| **Self-service tier** | Squad analysts + product owners | Members and external auditors get curated views only |

## 3. Roles & responsibilities

| Role | Responsibilities |
|------|------------------|
| **Platform Lead** | Shared semantic layer, data integration patterns, lineage, KPI catalog |
| **Vertical Product Lead** | KPI definitions, dashboards, action loops |
| **Privacy Lead** | Approves any analytic surface that mixes data across tenants or that uses Confidential / Restricted data |
| **Security Lead** | Reviews new data movement and external sharing |
| **AI Lead** | Owns the boundary between analytics and AI surfaces (when does a "report" become a "model") |

## 4. Demand intake

1. Request lands in the owning vertical's product backlog (no separate analytics backlog).
2. Cross-vertical requests escalate to Platform Lead.
3. New KPI definitions are proposed in PR against the KPI catalog (TODO: `governance/analytics/kpi-catalog.md`).
4. Net-new data movement (new source, new sink, new cross-tenant view) follows the **Data Integration Pattern Selection** rubric (§6) and requires a privacy/security touchpoint.

## 5. Service levels

| Tier | Examples | SLO |
|------|----------|-----|
| Operational | Console real-time KPIs, Union-Eyes case dashboard | 99.5% availability of the parent app |
| Decision-support | CFO monthly close, partner billing | Refresh ≤ 24h, accuracy reconciled monthly |
| Strategic | Board KPIs, regulatory reports | Refresh ≤ 7 days, dual-controlled before publication |
| Member-facing | Member portal stats | Privacy review required; tenant isolation enforced |

## 6. Data integration patterns (selection rubric)

Adapted from Info-Tech *Build a Data Integration Strategy*. Pick the
**lowest-coupling** option that meets the requirement.

| Need | Pattern | Use when |
|------|---------|----------|
| Read another service's data point inline | API call (sync) | Volume small, freshness critical |
| Aggregate across services for a dashboard | Materialized view in shared analytics schema | Read-heavy, eventual consistency OK |
| React to an event | Outbox + event bus (async) | Decoupled domains, replayable |
| Move large datasets periodically | Scheduled ETL/ELT | Batch acceptable, transformation needed |
| Stream | Kafka-style change feed | Sub-minute latency required |

Anti-patterns: direct cross-service DB reads; ad-hoc CSV exports
between humans; "I'll just join the prod DB."

## 7. Governance hooks

- All analytic surfaces using AI inference must be in [`governance/ai/inventory.json`](../ai/inventory.json).
- All data stores feeding analytics must be in [`governance/privacy/data-inventory.json`](../privacy/data-inventory.json).
- Cross-border analytic data flows require a documented transfer mechanism (enforced by [`tooling/contract-tests/data-inventory-integrity.test.ts`](../../tooling/contract-tests/data-inventory-integrity.test.ts)).
- Analytic surfaces displaying member-level data must have an access-control test in `tooling/contract-tests/`.

## 8. Open work

- [ ] Publish the KPI catalog (`kpi-catalog.md`)
- [ ] Document the shared semantic layer (tables, ownership, refresh cadence)
- [ ] Stand up a `BI-Practice-Assessment` per `infotech/Reporting/_extracted/Build-a-Reporting-and-Analytical-Insights-Strategy/03-BI-Practice-Assessment-Tool.xlsx`
- [ ] Decide whether to adopt a dedicated BI tool (currently embedded only)
- [ ] Wire a quarterly analytics review into the AIGC monthly report

## 9. References

- Source bundles:
  - `infotech/Reporting/_extracted/Establish-an-Analytics-Operating-Model (1)/`
  - `infotech/Reporting/_extracted/Build-a-Reporting-and-Analytical-Insights-Strategy/`
  - `infotech/Reporting/_extracted/Build-a-Data-Integration-Strategy/`
- DAMA-DMBOK 2 — Data Management Body of Knowledge
- Kimball Group — dimensional modeling for analytic schemas
