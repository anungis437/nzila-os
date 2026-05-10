# Portfolio Focus Discipline

> **This document is a constraint document, not a roadmap.**
> Its purpose is to prevent diffusion. Read it before starting any new initiative.
> **Owner:** Platform Owner  
> **Effective:** 2026-04-20  
> **Horizon:** 6 months (Apr 2026 – Oct 2026)  
> **Reassess:** After first signed pilot; full re-review at 6-month mark (2026-10-20)

---

## The Rule

**For the next 6 months, the only commercial priority is Union Eyes.**

Everything else supports Union Eyes or waits.

This is not a 30-day sprint. This is the commercial foundation window. The first pilot, first conversion, and first SaaS customer must be secured in this period. Diffusion before those milestones kills the entire GTM.

---

## Tier Structure

### Tier 1 — Main Commercial Focus: Union Eyes

**Status:** SELL NOW · Pilot-safe · Audit-hardened  
**App:** `apps/union-eyes`

This is the product that is ready. It has a governed evidence model, instrumented KPIs, a buyer-ready one-pager, tiered pilot options, and pricing. The work now is **not building** — it is **selling**.

Actions that are allowed without question:

- Outreach to prospects
- Readiness briefings and sales calls
- Pilot provisioning and delivery
- Case study capture
- Bug fixes and SLA response in active pilots
- Enhancements directly requested by a live pilot organization (as a scoped services item)

Actions that require Platform Owner sign-off before starting:

- Any new Union Eyes feature not requested by an active buyer
- Changes to the Union Eyes data model that affect current schema
- New integrations not part of an active pilot scope

---

### Tier 2 — Supporting Focus: Flow

**Status:** PILOT · Weeks 12–22 per rollout plan  
**App:** `apps/flow`

Flow is the next commercial product after Union Eyes reaches its first conversion. It is not being pitched in parallel — it supports the narrative that the platform has breadth.

Actions that are allowed:

- Maintenance and test coverage
- Documentation of what Flow can do (capability matrix, buyer pack)
- Responding to inbound questions about Flow from prospects already engaged on Union Eyes

Actions that are not allowed without explicit re-prioritization:

- Active outreach for Flow-only engagements
- New feature development on Flow while Union Eyes has no signed pilots

---

### Tier 3 — Paused: Zonga, Agrimo, and All Others

**Status:** PAUSED — No commercial timeline for 6 months  
**Apps:** `apps/zonga`, `apps/agrimo`, `apps/cora`, `apps/trade`, `apps/platform-admin`, `apps/orchestrator-api`

These products exist. They will not receive attention during this focus period.

Actions that are allowed:

- Passing automated tests and keeping lint clean
- Dependency security patches
- Architecture maintenance that is part of a monorepo-wide change

Actions that are explicitly not allowed during the focus period:

- New feature work
- New pages, new routes, new APIs
- New integrations
- Pilot conversations
- Any outreach or pitch activity
- Dedicated engineering sprint work

**Exception rule:** If an inbound, unsolicited prospect arrives for a Tier 3 product, log it in Tab 5 (Product Requests) of the command center and schedule a separate assessment after the Union Eyes first conversion. Do not activate Tier 3 work for any reason before then.

---

## What We Will NOT Do

This section is equally important as what we will do. The patterns below have historically destroyed focus in early-stage platforms. They are explicitly off the table.

### Product

- **No new apps or product concepts** — There are 16 apps. None are added in this window.
- **No re-architectures of working systems** — If it passes tests and is in production, it's not touched unless a buyer-blocking bug exists.
- **No exploratory integrations** — No building integrations that no prospect has asked for.
- **No "improving" things that aren't broken** — Refactors, cleanups, and optimizations without a buyer-facing reason are banned.
- **No "let's do a quick design sprint" for a new feature** — Product decisions are driven by buyer conversations in this period, not internal enthusiasm.

### Commercial

- **No parallel outreach for Flow, Zonga, or any Tier 3 product** — Union Eyes only.
- **No pitching multiple products in a single meeting** — One product, one ask, one outcome per engagement.
- **No founder-authored thought leadership that diverts to Tier 3 products** — Content output is Union Eyes-focused.
- **No building before the first pilot signs** — The platform is built. The work is selling.
- **No free pilots or unpaid proof-of-concepts** — Discovery Sprints start at $7K. Free work signals low value.

### Organizational

- **No hiring before the hiring triggers in the revenue model are met** — See `docs/gtm/REVENUE_MODEL_36_MONTHS.md`
- **No strategic pivots during active pilots** — If something isn't working, it's addressed after the current pilot closes.
- **No delegating the first sales cycles** — Founder-led selling for the first 5 customers minimum. No exceptions.
- **No investor conversations while the pipeline is empty** — Get a pilot signed first.

---

## What "Not a Builder Day" Means

The platform is built. The question is no longer "can we build it" — it is "can we sell it."

For the next 30 days, a productive day looks like:

| Activity | Count per Day |
|----------|-------------|
| Prospect research or outreach | 2–5 contacts |
| Follow-up on open pipeline | 1–3 touches |
| Pilot delivery work (if active) | As required |
| Case study capture (if pilot active) | Weekly update |
| Platform maintenance (bugs, security) | As required |
| New feature work | 0 unless buyer-requested |

A day that ends with only code written and no commercial action taken is a step backward during this period.

---

## Red Lines

These are the patterns that destroy focus. If you find yourself doing any of these, stop and re-read this document:

1. **Starting a new side app concept** — There are 16 apps already. No new apps.
2. **Re-architecting something that works** — If it passes tests and is in production, leave it alone.
3. **Adding capabilities to Tier 3 apps** — Every hour on Zonga is an hour not on Union Eyes pipeline.
4. **Debating product direction without a buyer in the room** — Buyer demand drives product decisions now, not internal hypotheses.
5. **Optimizing the platform without a specific buyer blocker** — Optimization is for after the first signed contract.

---

## Focus Period Timeline (6 Months)

| Milestone | Target Date | Status |
|-----------|------------|--------|
| Focus period begins | 2026-04-20 | — |
| First prospect contacted | 2026-04-25 | — |
| First readiness briefing | 2026-05-05 | — |
| First proposal sent | 2026-05-15 | — |
| First pilot agreement signed | 2026-06-01 | — |
| First pilot active (live) | 2026-06-07 | — |
| 30-day commercial check | 2026-05-20 | — |
| 2nd pilot active | 2026-07-01 | — |
| First SaaS conversion proposal sent | 2026-08-15 | — |
| First SaaS contract signed | 2026-09-01 | — |
| 3rd pilot active | 2026-09-01 | — |
| 6-month full review | 2026-10-20 | — |

At the 6-month review, if the first SaaS conversion has occurred, the focus discipline can be updated to allow Tier 2 (Flow) commercial activity. Not before.

---

## Reassessment Criteria (6-Month Gate)

To justify expanding focus beyond Tier 1 at the 6-month mark, at least **two** of the following must be true:

- [ ] A pilot agreement is signed
- [ ] A SaaS contract is signed (first paid recurring customer)
- [ ] 5+ active readiness briefings have been completed
- [ ] An inbound request for a Tier 2 product has arrived from a qualified prospect already in the Union Eyes pipeline
- [ ] Union Eyes MRR ≥ $15K/month

If fewer than two are true, the focus period extends with no change to Tier 2 or 3 activation.

**Early expansion gate (any time before 6 months):**  
A first SaaS contract signed = permission to add Flow to active commercial conversations. Not before.

---

## Accountability

**Platform Owner** holds themselves accountable to this document.

Weekly check-in question (ask yourself every Monday):
> *"Did I take at least 3 commercial actions this week?"*

If the answer is no, the week was structurally misallocated regardless of what was built.
