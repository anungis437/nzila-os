# Union Eyes — Runtime Depth Audit

**Audit date:** 2026-05-15
**Posture:** validation-only

Each runtime surface is graded on a 6-level depth scale that orthogonally cuts the readiness matrix. Depth measures how much of the institutional substrate the page actually projects at runtime — independent of how good its narrative copy is.

| Depth | Definition |
| --- | --- |
| 1 | Fully hydrated: real substrate + IGG/continuity/chronology/topology + provenance & explainability disclosed |
| 2 | Strong runtime integration: real substrate + at least one of continuity/chronology/topology |
| 3 | Partially projection-backed: real substrate but no IGG enrichment |
| 4 | Mostly semantic shell: DB-backed CRUD, no institutional convergence |
| 5 | Prototype scaffold: mock arrays / hard-coded fixtures |
| 6 | Narrative-only surface: pure static copy |

---

## 1. Distribution

| Depth | Count | Routes |
| --- | ---: | --- |
| 1 | 6 | governance-center, institutional-observability, institutional-topology, institutional-chronology, longitudinal-cognition, executive-operating-intelligence |
| 2 | 4 | institutional-memory, continuity-intelligence, continuity-planning, continuity-simulation |
| 3 | 4 | cba-intelligence, cognition, intelligence (shell), governance (bylaws – tracks projection but no enrichment) |
| 4 | ~32 | dashboard CRUD families: workbench, inbox, priorities, operations, ops/performance, governance, analytics, analytics-admin, sector-analytics, cross-union-analytics, movement-insights, members, claims, cases, grievances, bargaining (and all sub-routes), agreements, clause-library, precedents, communications + sub, education + sub, knowledge / knowledge-base, dispatch, calendar, correspondence, audits, reports, surveys, finance + sub, financial + sub, dues + sub, strike-fund + sub, pension + sub, employer-execution + sub, federation + sub, clc + sub, committees, leadership, elections + sub, voting, structure, data-source, integrations, settings + sub, security, billing-admin, profile, customer-success, support, targets, work, mobile + sub, rewards (excl. leaderboard) |
| 5 | 2 | debug, sentry-example-page |
| 6 | ~30 | All marketing trees ((marketing)/* and [locale]/(marketing)/* — trust, governance, institutional-continuity, story, contact, status, proof, conventions, pricing, pilot-request, legal/*, solutions/*, features/*, platform/*, insights/* + slugs, case-studies/* + slugs, for-{members,representatives,leadership,clc,federations}) |

(API routes are excluded from depth grading as their depth is determined by their consumers.)

---

## 2. Depth ↔ readiness alignment

A surface's depth must match its narrative claim. Drift is *not* low-depth-on-CRUD (that is acceptable); drift is **high-narrative-claim with low-depth-substrate**.

| Surface | Depth | Narrative claim | Aligned? |
| --- | :-: | --- | --- |
| governance-center | 1 | "Cognition kernel + anti-surveillance" | ✅ aligned |
| institutional-{observability,topology,chronology} | 1 | Substrate read surfaces | ✅ aligned |
| longitudinal-cognition / executive-operating-intelligence | 1 | Institutional storybook / executive briefing | ✅ aligned |
| institutional-memory | 2 | "Procedural lineage + preserved context" | ⚠ narrative slightly deeper than substrate; close at depth 2 |
| continuity-{intelligence,planning,simulation} | 2 | "Fragility / resilience / disruption simulation" | ⚠ acceptable, but topology gap should close to reach depth 1 |
| cognition | 3 | "Cognition" framing | ❌ narrative implies depth 1; substrate is depth 3 — convergence-needed |
| intelligence (tabbed shell) | 3 | "Research + analysis + executive" | ❌ narrative implies depth 1; substrate is depth 3 |
| movement-insights / cross-union-analytics / sector-analytics | 4 | "Insights / analytics" | ❌ depth-4 SQL roll-up, narrative implies analytics depth — must reframe to "trends" |
| All CRUD families (workbench, inbox, claims, cases, grievances, bargaining, finance, …) | 4 | Operational tools (no institutional claim) | ✅ aligned |
| All marketing pages | 6 | Procurement narrative | ✅ aligned |
| debug / sentry-example-page | 5 | dev-only | ✅ but exclude from prod |

---

## 3. Depth-1 surfaces — production readiness

All six depth-1 surfaces project substrate read-only with provenance, explainability, and protected-token redaction enforced through `assertNoProtectedKindsInReadSurface()`. Verified clean against:

- 162 IGG tests passing (commit 727c2395c).
- Narrative audit: 0 hard-fail, 0 rule failures, maturity 87.
- No protected-token leakage outside admin/governance console + stewardship-appendix.

These six surfaces are **procurement-presentable today**.

---

## 4. Depth-2 → depth-1 conversion path

| Surface | Missing layer(s) | Workstream H artifact that closes it |
| --- | --- | --- |
| institutional-memory | Topology projection + provenance footer | `topology-source-adapter` |
| continuity-intelligence | Topology + chronology weave | `topology-source-adapter` + `runFullInstitutionalCognition` envelope |
| continuity-planning | Topology + chronology weave | same as above |
| continuity-simulation | Topology + chronology weave | same as above |

No schema mutation, no new package, no new module is required to lift these surfaces from depth-2 to depth-1.

---

## 5. Depth-3 surfaces requiring convergence (high priority)

| Surface | Convergence direction (validation-only recommendation) |
| --- | --- |
| cognition | Route the existing scoring calls through `composeInstitutionalStorybook` so output is storied + redacted, not raw KPI snapshots. |
| intelligence | Already a tabbed shell; convergence happens at each tab. Add a substrate-presence check at shell level so shell never renders without backing data. |
| cba-intelligence | Wire CBA freshness signal into `chronology` + `provenance` envelope before invoking the cockpit. |
| governance (bylaws CRUD) | Acceptable as depth-3; add a side panel link into `institutional-chronology`. |

---

## 6. Depth-4 normalization

The 32 depth-4 CRUD surfaces are correctly graded — they are operational tools, not institutional cockpits. They should remain depth-4. The work for these surfaces is **labelling** (make the navigation accurately call them "case", "billing", "education" etc.) rather than substrate enrichment. Three exceptions where depth-4 + analytic label = drift: `movement-insights`, `cross-union-analytics`, `sector-analytics`. These are documented in `legacy-semantic-drift-audit.md`.

---

## 7. Depth-5 / depth-6 hygiene

- **Depth 5:** `debug` and `sentry-example-page` should be excluded from the production build output (next.config or env-flagged).
- **Depth 6:** Marketing pages are at the correct depth. Maintain narrative parity across the dual marketing trees (`(marketing)` and `[locale]/(marketing)`) — see `locale-parity-audit.md`.
