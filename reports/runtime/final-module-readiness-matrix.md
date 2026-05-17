# Union Eyes — Final Module Readiness Matrix

**Audit date:** 2026-05-15
**Posture:** validation-only

This matrix is the synthesis of all eight prior audits (inventory, drift, convergence, depth, onboarding/admin/procurement, observability, locale, protected). It assigns every runtime surface family to one of ten readiness states.

---

## 1. Ten-state classification

| State | Definition |
| --- | --- |
| 1. Mature | Substrate-converged, narrative-aligned, gated, fenced. Procurement-presentable today. |
| 2. Strong but incomplete | Substrate present, narrative aligned, missing one of: provenance footer, topology projection, locale parity. |
| 3. Runtime-fragmented | Substrate exists but not woven; tabbed / shell architecture defers convergence to children. |
| 4. Legacy-semantic drift | Substrate may be fine; framing carries SaaS / surveillance / scoring connotations. |
| 5. Prototype-only | Mock arrays, fixtures, dev-only surface. |
| 6. Scaffold-only | Empty / stub / example. |
| 7. Conceptually aligned but shallow | Narrative is mature but substrate hydration is < depth-2. |
| 8. Architecturally risky | Pattern carries risk irrespective of current content. |
| 9. Governance-sensitive | Touches protected substrate; correctness gating > velocity. |
| 10. Requires convergence | Cross-cuts of 3, 4, 7 — surface needs an additive convergence pass before procurement use. |

---

## 2. Final assignments

### State 1 — Mature
- /dashboard/governance-center
- /dashboard/institutional-observability *(label monitor)*
- /dashboard/institutional-topology
- /dashboard/institutional-chronology
- /dashboard/longitudinal-cognition *(label monitor)*
- /dashboard/executive-operating-intelligence *(label monitor)*
- /dashboard/admin/governance (governance-console)
- /dashboard/audits
- /dashboard/trust (system integrity)
- /dashboard/operations, /dashboard/ops/performance, /dashboard/analytics-admin (operational observability)
- All `/(marketing)` and `/[locale]/(marketing)` core pillars: trust, trust/stewardship-appendix, governance, institutional-continuity, story, contact, status, proof, conventions, pricing, pilot-request, legal/*

### State 2 — Strong but incomplete
- /dashboard/institutional-memory (topology gap)
- /dashboard/continuity-intelligence (topology + provenance footer)
- /dashboard/continuity-planning (topology + provenance footer)
- /dashboard/continuity-simulation (topology + provenance footer)
- /(marketing)/case-studies, /(marketing)/insights — strong narrative, partial localization
- /(marketing)/for-{members, representatives, leadership, clc, federations} — strong, partial localization

### State 3 — Runtime-fragmented
- /dashboard/intelligence (tabbed shell over partial substrate)
- /dashboard/cba-intelligence (DB-backed, uneven hydration)

### State 4 — Legacy-semantic drift
- /dashboard/rewards/leaderboard (forbidden vocabulary)
- /dashboard/cross-union-analytics
- /dashboard/sector-analytics
- /dashboard/movement-insights
- /(marketing)/platform/explainable-intelligence (label)
- /(marketing)/executive-intelligence (label)
- /(marketing)/features/ai-workbench (label)
- Components: financial/FinancialOverview.tsx (comment), public/site-navigation.tsx (`Continuity Command Center`, `Governance Intelligence Hub`), marketing/insight-article-view.tsx (pillar label), marketing/institutional-visual-systems.tsx (pillar diagram copy), cope/CanvassingInterface.tsx (`Volunteer Leaderboard`), intelligence/intelligence-shell.tsx (tab labels)
- Locale bundles: `commandCenter`, `Tableau de bord exécutif`, `Centre de commande`, `scoring`, `Notation IA`

### State 5 — Prototype-only
- /dashboard/debug

### State 6 — Scaffold-only
- /sentry-example-page
- Root-level duplicate auth pages (`/sign-in`, `/sign-up`, `/signup`, `/login`, `/reset-password`, `/forgot-password`)

### State 7 — Conceptually aligned but shallow
- /dashboard/cognition (substrate exists but bypasses IGG enrichment)
- /[locale]/continuity-crisis (strong landing, partial substrate)
- /[locale]/field-operations (operational landing, partial substrate)

### State 8 — Architecturally risky
- Dual marketing tree (`(marketing)` + `[locale]/(marketing)`) — risk is doctrine drift between the two trees, not architecture itself.
- Duplicate analytics tree (`/dashboard/analytics` + `/(dashboard)/analytics`) — risk of divergence.

### State 9 — Governance-sensitive
- /dashboard/admin/governance + /api/governance/reserved-matters (protected fence)
- /dashboard/governance-center (cognition kernel)
- /dashboard/longitudinal-cognition, /dashboard/executive-operating-intelligence (cognition output)
- /dashboard/movement-insights, /dashboard/cross-union-analytics, /dashboard/sector-analytics (cross-org aggregation)
- /[locale]/(marketing)/trust/stewardship-appendix (sole sanctioned procurement narrative)

### State 10 — Requires convergence
- /dashboard/intelligence (state 3 + state 4 label)
- /dashboard/cognition (state 7 + state 4 label)
- /dashboard/cross-union-analytics (state 4 + state 9)
- /dashboard/sector-analytics (state 4 + state 9)
- /dashboard/movement-insights (state 4 + state 9)
- /dashboard/cba-intelligence (state 3)
- /dashboard/rewards/leaderboard (state 4)
- /dashboard/institutional-memory + 3 continuity cockpits (state 2 + WS H adoption available)

All other ~150 dashboard CRUD surfaces are correctly classified at depth-4 / state 1-2 and do **not** require convergence.

---

## 3. Production-readiness summary

| Bucket | Count (page-surface) | Notes |
| --- | ---: | --- |
| Procurement-presentable today | ~40 | All marketing pillars + 6 depth-1 institutional + admin governance + audits/trust/ops |
| Near-prod (state 2) | ~120 | All operational CRUD families + onboarding landings |
| Convergence-needed (state 10) | 9 | The named surfaces above |
| Drift/legacy (state 4 only, no other state) | 7 components + 1 route + locale strings | Renames / re-framing |
| Dev-only / scaffold | 7 routes | Exclude from prod |

---

## 4. Final verdict

The union-eyes runtime is, at the page layer, **substantively procurement-ready**. The substrate is in place, the protected fence holds, the narrative gate is green, the depth-1 institutional surfaces project correctly, and the procurement demo path is coherent.

The residual risk is concentrated in **nine convergence-needed surfaces** (all addressable additively without schema / architecture change), **a small set of label / vocabulary drift items** (renames + locale string substitutions), and **localization parity for fr / fr-CA institutional vocabulary** (additive translation work).

No surface requires architectural redesign. No surface requires schema mutation. No surface requires a new module. Workstream H (already landed) provides the substrate adapter that closes the depth-2 → depth-1 gap on the four still-partial cockpits.
