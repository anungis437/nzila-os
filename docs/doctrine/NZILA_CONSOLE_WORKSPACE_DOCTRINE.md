# Nzila Console — Workspace Doctrine

> Status: **v1 — Foundational**
> Owner: Nzila Ventures (Founder / Platform)
> Surface: `apps/console` → route group `(dashboard)/workspace`
> Companion docs: [Tab Schema](./NZILA_CONSOLE_TAB_SCHEMA.md) · [Telemetry Schema](./NZILA_CONSOLE_TELEMETRY_SCHEMA.md) · [Workspace Map](./NZILA_CONSOLE_WORKSPACE_MAP.md)

---

## 1. Why Console exists

Nzila OS today is a constellation of ventures and engines — Union Eyes, TrustCore,
Institutional Intelligence, Deal Engine, the Observatory, and a deep bench of future
verticals (Health, Civic, Education). Each is real. None of them share a single
**operational surface**.

The result is the same failure pattern The Button hit before Club360: dozens of
disconnected pages, each correct in isolation, none of them composing into one place
where the operator can answer *"what is true right now?"*.

**Console is the operating system surface, not an admin page.**

It is the single entry point from which every venture becomes a *workspace* rather than
another disconnected application. When a new venture, signal, or flow is added to Nzila
OS, it does not get a new top-level app — it **plugs into Console**.

---

## 2. The Club360 precedent

| The Button (before) | The Button (after) |
| --- | --- |
| 20+ disconnected pages | One Club360 Workspace with tabs: Overview · Membership · Compliance · Support · Documents · Services |

The workspace became the entry point. The pages did not disappear — they were
**subordinated** to a single operational surface that gave them context and order.

Nzila OS is at the same inflection point. The existing `apps/console` already carries
60+ routes across 11 sidebar groups. That is the "20+ disconnected pages" problem,
just inside one app. Console v1 does not delete those routes — it gives them a home.

---

## 3. The six-workspace model

Console v1 is exactly six workspaces plus Settings. No more.

```
Nzila Console
 ├── Overview      — portfolio health at a glance (the morning screen)
 ├── Portfolio     — what businesses exist, what stage, what is healthy/blocked
 ├── Observatory   — assessments, routes, conversions, reassessments
 ├── Sales         — unified GTM: leads → opportunities → proposals → pilots → conversions
 ├── Ventures      — per-venture maturity, roadmap, revenue, customers, blockers
 ├── Operations    — founder cockpit: tasks, risks, decisions, governance, documentation
 └── Settings      — account, workspace configuration
```

Each workspace owns a clear question:

- **Overview** → *Is the portfolio healthy this morning?*
- **Portfolio** → *What exists, what stage is it in, what deserves attention?*
- **Observatory** → *What is the market validation engine telling us?*
- **Sales** → *Where is revenue in the pipeline?*
- **Ventures** → *How mature is each venture, and what is blocking it?*
- **Operations** → *What must the founder personally move this week?*

---

## 4. Doctrine principles

1. **Console is the front door.** Every future product plugs into Console as a workspace.
   New ventures do not get new top-level navigation; they get a card and a workspace.

2. **Six workspaces, hard cap (v1).** Resist the urge to add a seventh top-level tab.
   New surfaces go *inside* an existing workspace as a sub-tab, or as a Venture.

3. **One question per workspace.** If a workspace can no longer be summarized in a single
   sentence, it is doing too much and must be split into sub-tabs.

4. **No AI, no automation, no speculative dashboards in v1.** Console v1 is the
   *operational surface*. Intelligence and automation layer on later, on top of a stable
   surface — never as a substitute for it.

5. **Real data where it cleanly exists; honest empty states everywhere else.** Console
   reads from canonical sources (the portfolio catalog, the Deal Engine lifecycle, the
   Observatory schema). Where a source is not yet wired, Console shows a calm, explicit
   "awaiting first data" state — never fabricated numbers.

6. **The plug-in contract is the point.** The value of Console is that the flow
   `IIA completed → Observatory updated → Route Decision generated → Union Eyes
   opportunity created → Pilot tracked` is visible end-to-end from one surface.

7. **Telemetry is first-class.** Every workspace and sub-tab view is observable from day
   one (see the Telemetry Schema), so we can learn which surfaces earn their place.

---

## 5. Canonical data sources (v1)

| Workspace | Primary source | Notes |
| --- | --- | --- |
| Overview | `governance/portfolio/product-catalog.json` + `@nzila/deal-engine` | Derived, deterministic — no live DB dependency in v1 |
| Portfolio | `governance/portfolio/product-catalog.json` | The single editable portfolio truth source |
| Observatory | `migrations/0031_institutional_intelligence_observatory_tables.sql` | Schema-driven; structural until cohort data lands |
| Sales | `@nzila/deal-engine` (`DEAL_STAGES`, `STAGE_METADATA`, seed) | Canonical commercial lifecycle |
| Ventures | `governance/portfolio/product-catalog.json` | Per-venture maturity + directive |
| Operations | Existing `(dashboard)` routes (`/risk`, `/governance`, `/audit`, `/execution`, `/docs`) | Console links and frames; does not duplicate |

---

## 6. The plug-in lifecycle (why start here)

Every future product plugs into Console. The canonical flow Console must make visible:

```
IIA completed
    ↓
Observatory updated
    ↓
Route Decision generated
    ↓
Union Eyes opportunity created
    ↓
Pilot tracked
```

Once Console exists, every venture becomes a workspace rather than another disconnected
application. This is the Club360 moment for Nzila OS.

---

## 7. Out of scope for v1

- AI summaries, copilots, or generative surfaces inside Console.
- Automation / autopilot actions.
- Net-new dashboards beyond the six workspaces.
- Migration or deletion of the existing 60+ `(dashboard)` routes — they remain reachable
  and are progressively subordinated to the workspaces over time.

---

## 8. Change control

Adding or removing a top-level workspace requires updating this doctrine **and** the
[Tab Schema](./NZILA_CONSOLE_TAB_SCHEMA.md) and [Workspace Map](./NZILA_CONSOLE_WORKSPACE_MAP.md)
in the same change. The six-workspace cap is intentional; widening it is a doctrine-level
decision, not an implementation detail.
