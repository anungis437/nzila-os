# Wave 4 — Experience Convergence Review

> Wave 4 is the *embodiment* phase of the runtime authority audit. Where
> Wave 3 deleted runtime surface, Wave 4 makes the remaining surface *feel*
> singular, calm, and institutionally inevitable. This review records the
> convergence work shipped on `feat/trustcore-trust-ops-v1` and classifies
> each coherence axis with operationally honest reasoning.

## Provenance

- Branch: `feat/trustcore-trust-ops-v1`
- Wave 1: `6a65c0d55` — audit foundation
- Wave 2: `fbd999cee` — gating hardening + 16 deny tests
- Wave 3 Phase A: `26462f3de` — sovereignty gates + nav convergence
- Wave 3 Phase B: `f61cdfbc1` — Tier A/B deletions + sovereignty deny tests
- Wave 4: _this commit_ — experience convergence

## Executive convergence results

The runtime previously exposed multiple overlapping executive/intelligence
semantics:

- `intelligence`
- `institutional-intelligence`
- `institutional-operating-intelligence`
- `executive-operating-intelligence`
- `movement-insights`
- `sector-analytics`
- `cross-union-analytics`

Wave 4 establishes **`dashboard/intelligence` as the single canonical
executive operating surface**. The convergence is enforced at three points:

1. **Marketing surface** — the new `(marketing)/platform/page.tsx` overview
   names `Intelligence` as one of eight canonical pillars and points all
   marketing nav + footer references at `/platform#intelligence`.
2. **Runtime navigation** — `dashboard-navbar.tsx` and `lib/dashboard/role-experience.ts`
   already (Wave 3) collapsed Cases / Grievances / Messages onto canonical
   surfaces; Wave 4 extends the doctrine to executive interpretation.
3. **Pricing surface** — the rebuilt `/pricing` page describes executive
   experience as *operational interpretation*, not "advanced analytics".

Remaining variants (`institutional-operating-intelligence`,
`executive-operating-intelligence`, `sector-analytics`, `cross-union-analytics`)
are retained as **bounded sub-surfaces of `intelligence`** — they are
gated drilldowns, not top-level semantic competitors. They will be folded
into tabs of `intelligence` in Wave 5.

## Navigation reduction results

Marketing primary nav now exposes a single canonical "Modules" dropdown
with the **eight canonical pillars** (Inbox, Work, Priorities,
Intelligence, Cognition, Governance, Institutional Memory, Trust). Each
pillar deep-links into the new `/platform` overview page anchor for that
surface. The footer "Platform" column mirrors the same eight-pillar spine.

Removed in Wave 3 (recorded here for continuity):
- 6 dashboard `LegacyRedirect` shims
- 10 `portal/*` pages

Retained / unified in Wave 4:
- `(marketing)/platform/page.tsx` — single overview surface for the
  eight-pillar canonical spine.
- `(marketing)/locale-site-navigation.tsx` — single Modules dropdown
  pointing into the canonical spine.
- `(marketing)/locale-site-footer.tsx` — Platform column aligned to
  the same eight pillars.

## Pricing convergence results

`/pricing` was rebuilt around the **operational maturity ladder**:

| Tier | Operational meaning |
|---|---|
| Foundation | Operational coordination |
| Governance Operations | Governance maturity |
| Institutional Continuity | Continuity infrastructure |
| Sovereignty Layer | Institutional operational sovereignty |

The page no longer carries:
- SaaS feature-grid language
- "Pro / Business / Enterprise" semantics
- AI hype framing
- Workflow-automation framing
- Startup-style CTA language

The page now communicates:
- Institutional continuity
- Governance maturity
- Operational stewardship
- Continuity-safe cognition
- Operational resilience
- Federation coordination
- Institutional memory
- Bounded governance-safe AI

Pricing alignment with the operational maturity model is now the
runtime's commercial spine — not a cost ladder bolted onto a feature
catalogue.

## Stakeholder simplification results

Stakeholder embodiment now follows the canonical surface alignment
established in Wave 3:

| Stakeholder | Lane (canonical surfaces) |
|---|---|
| Member | `inbox`, `claims/new`, `documents`, `settings` |
| Steward | `work`, `inbox`, `priorities`, `members`, `documents`, `correspondence` |
| Officer | + `targets`, `governance`, `intelligence` (federation tab) |
| Executive | `intelligence` (executive tab), `institutional-memory`, `governance` |
| Federation staff | `intelligence` (federation tab), `governance`, `members` (cross-org) |
| Governance reviewer | `governance`, `trust`, `audits`, `institutional-memory` |
| Sovereignty steward | + `cognition`, `longitudinal-cognition`, `customer-success`, `ops` |

Each lane is now expressed in `lib/dashboard/role-experience.ts` and
gated at the layout level for sovereignty-tier surfaces.

## Sovereignty-layer differentiation results

The six sovereignty / governance-ops layouts created in Wave 3
(`cognition`, `longitudinal-cognition`, `security`, `customer-success`,
`operations`, `ops`) are layout-gated against `requireUser` +
`hasMinRole`. Wave 4 establishes the **doctrine framing** for these
surfaces in the `/platform` overview:

> "Bounded, governance-safe, continuity-critical reasoning over the
> institution's memory. Gated to sovereignty stewards. Not a chat
> product — an operational reasoning substrate."

Visual / copy differentiation (calmer headers, governance posture
copy, escalation framing) is recorded as **Wave 5 follow-on** —
the gating + canonical doctrine is in place, but per-surface
layout polish is not yet uniform.

## Runtime contraction metrics

Live `dir /s /b apps\union-eyes\app\*page.tsx` scan:

| Metric | Wave 1 | Wave 3 | Wave 4 | Wave-3→4 delta |
|---|---:|---:|---:|---:|
| `page.tsx` count | 306 | 290 | 291 | +1 |
| `route.ts` count | n/a | 867 | 867 | 0 |
| Layout-level gates | 0 | 18 | 18 | 0 |
| Cross-role deny scenarios | 5 | 31 | 31 | 0 |
| Canonical marketing pillars | dispersed | 8 (nav) | 8 (nav + `/platform` page) | unified |
| Pricing tiers | 4 (SaaS-flavoured) | 4 (SaaS-flavoured) | 4 (operational maturity) | doctrine-converged |

> The +1 page is the new `(marketing)/platform/page.tsx` overview surface.
> This is not surface expansion — it is **convergence infrastructure**,
> the single page that anchors all eight canonical pillar links from
> nav and footer into one continuous institutional reading.

## Remaining overlap candidates (Wave 5 queue)

- `institutional-operating-intelligence` — fold into `intelligence` tab
- `executive-operating-intelligence` — fold into `intelligence` tab
- `sector-analytics` — fold into `intelligence` tab
- `cross-union-analytics` — fold into `intelligence` tab
- `analytics-admin` — fold into `intelligence` admin drilldown
- `governance-*` variants — collapse into `governance` with subtabs
- `knowledge-*` variants — collapse into `institutional-memory`
- `members` vs `member` plural/singular — choose one form
- `operations` vs `ops` — collapse into `operations`

## Remaining deferred runtime surfaces (carry-overs)

- **Tier C** (Wave 3 deferral): `sign-in/page.tsx`, `sign-up/page.tsx`
  — analytics window required before deletion. Carries to Wave 4 → Wave 5.
- **Marketing platform sub-pages** — `(marketing)/platform/{governance-intelligence,
  organizational-memory, executive-intelligence, operational-coherence,
  explainable-intelligence}/page.tsx` still exist. They are now overshadowed
  by the canonical `/platform` overview but kept for SEO and deep-link
  continuity. Wave 5 should evaluate redirect-to-anchor strategy.

## Final verdicts

| Coherence axis | Verdict | Reasoning |
|---|---|---|
| Runtime coherence | **GO** | Eight canonical pillars expressed consistently across runtime nav, role-experience, marketing nav/footer, and `/platform` overview. |
| Stakeholder coherence | **GO** | Each role experience expresses one operational lane; sovereignty surfaces gated. |
| Executive coherence | **CONDITIONAL GO** | `intelligence` is canonical, but four executive variant routes remain — must collapse to tabs in Wave 5. |
| Pricing coherence | **GO** | Operational maturity model fully replaces SaaS feature framing; institutional risk language is the spine. |
| Continuity coherence | **GO** | Institutional Memory pillar is canonically named, doctrinally framed, and runtime-gated. |
| Governance coherence | **GO** | Governance pillar elevated; `governance-*` collapse queued for Wave 5. |
| Sovereignty coherence | **CONDITIONAL GO** | Layout gates + doctrine framing are in place; per-surface visual differentiation deferred to Wave 5. |
| Institutional embodiment | **GO** | UE now reads as sovereign institutional continuity infrastructure: calm, bounded, operationally trustworthy, procurement-safe. |

## Operationally honest summary

Wave 4 did **not** add features. It made the existing surface
*inevitable* by:

1. Unifying eight canonical pillars across runtime nav, role-experience,
   marketing nav, marketing footer, and a new single `/platform`
   overview surface.
2. Rebuilding `/pricing` around the operational maturity ladder so
   commercial framing matches operational doctrine.
3. Recording explicit Wave-5 carry-overs (executive-variant collapse,
   sovereignty visual differentiation, marketing platform sub-page
   redirect strategy, sign-in/sign-up Tier C analytics window).

The runtime now reads as **one institutional operating experience**.
The remaining work is sub-surface refinement, not architectural.
