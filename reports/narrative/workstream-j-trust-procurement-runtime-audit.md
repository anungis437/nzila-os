# Workstream J — Trust & Procurement Runtime Convergence (Audit)

**App:** `apps/union-eyes`
**Underlying substrate:** `apps/union-eyes/lib/institutional-legitimacy.ts` (read-only governance copy
exports), `components/onboarding/*`, `components/admin/evidence-export.tsx`, marketing
`(marketing)/solutions/procurement/page.tsx`, `(marketing)/trust/*`, `(marketing)/runtime/*`,
`api/onboarding/discover-federation/*`, `lib/sovereignty/*`.
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Strategic principle:** *Coexistence-oriented, sovereignty-conscious, governance-safe deployment —
not a transformation platform, not a governance command center, not centralized operational control.*
**Layer:** Display / read-only narrative copy / governance-config. **No architecture rewrites,
no RBAC changes, no tenancy changes, no deployment-model rewrites, no onboarding flow rewrites,
no procurement-system rewrites, no evidence-schema rewrites.**

> Workstream J answers **"how does this institution adopt, operate, and trust the deployment
> over time, while preserving its own sovereignty?"** — never **"how do we standardize, optimize,
> or centrally control institutional behaviour?"**.

## Method

This audit was performed by:

1. Inventorying the public copy / data exports of `apps/union-eyes/lib/institutional-legitimacy.ts`
   (rollout pathway, governance journey, maturity pathway, evidence architecture, deployment
   timelines, walkthroughs, before/after map, procurement evidence binder, disruption models,
   onboarding continuity scenarios, executive dashboard signals).
2. Inventorying existing union-eyes runtime/onboarding/procurement/trust/evidence surfaces:
   `components/onboarding/admin-onboarding-wizard.tsx`, `components/onboarding/tour-steps.ts`,
   `components/admin/evidence-export.tsx`, marketing pages under `(marketing)/solutions/procurement`,
   `(marketing)/trust/*`, `(marketing)/runtime/*`, `(marketing)/institutional-continuity`,
   sovereignty / federation discovery endpoints.
3. Cross-referencing against the WS J ten-question audit grid and the additive-only fence
   (no schema, RBAC, tenancy, deployment-model, onboarding-flow, procurement-system, or
   evidence-schema rewrites).
4. Mapping each existing surface onto a coexistence / sovereignty / continuity / explainability
   framing — keeping every change additive, copy-level, and governance-safe.

## Substrate already available to WS J (read-only)

The runtime / procurement / trust / onboarding substrate is rich and already governance-aligned.
WS J is purely an *additive convergence* of the language, framing, and narrative posture across
these surfaces — no new data, no new schemas, no new flows.

| Substrate export / surface | Shape | WS J use |
|---|---|---|
| `institutionalRolloutPathway` (`institutional-legitimacy.ts` L3) | 7 stages: Assessment → Long-Term Resilience | **phased adoption rail** — already consumed on procurement page |
| `governanceModernizationJourney` (L13) | 5 stages with detail strings | **governance journey rail** — frame as "coexistence path", not transformation |
| `operationalMaturityPathway` (L41) | 5 stages: Reactive → Institutionally Resilient | **maturity reflection** — frame as inspectable continuum, not a scoring ladder |
| `organizationalTransformationPathway` (L49) | 5: Operational Fragmentation → Institutional Resilience | **continuity pathway** — wrap with positive coexistence doctrine note; do **NOT** rename (used by `institutional-continuity/page.tsx` L36/303–306) |
| `evidenceArchitecture` (6 items) | per-domain evidence layers | **evidence stewardship map** — provenance / chronology framing |
| `deploymentTimelines` (L210, 5 items) | phased pacing copy | **deployment pacing rail** — sovereignty-paced, not vendor-paced |
| `institutionalRolloutSimulationFlow` | sequenced rollout simulation copy | **rollout simulation walkthrough** — coexistence-framed |
| `governanceOperationalWalkthroughs` (6 incl. Procurement review) | per-walkthrough copy | **governance walkthrough cards** — explainability-first |
| `institutionalBeforeAfterMap` (6 items) | before/after pairs | **continuity-aware before/after** — frame as "what is preserved", not "what is transformed" |
| `organizationalMaturitySnapshots` (5) | per-stage snapshot copy | **inspectable snapshots** — no scoring |
| `procurementEvidenceBinder` (L317, 8 items) | per-binder evidence categories | **procurement evidence binder** — sovereignty-conscious, governance-safe |
| `governanceReviewSimulationLayers` | per-layer review copy | **review walkthrough layers** — explainability + provenance |
| `executiveDashboardSignals` | per-signal copy | **executive signals** — frame as "inspectable posture", not "command center" |
| `operationalDisruptionModels` (L482, 5 areas) | focus / signal / mitigation per area | **continuity safeguards rail** — mitigation-first, not surveillance-first |
| `organizationalStabilizationSimulationFlow` | stabilization sequence copy | **stabilization walkthrough** — continuity safeguards |
| `onboardingContinuityIntelligenceScenarios` | onboarding continuity scenarios | **continuity-aware onboarding** scenarios |
| `components/onboarding/admin-onboarding-wizard.tsx` | 5-step wizard (Overview, Users, Security, Integrations, Reporting); `AdminOnboardingData` interface | **continuity-aware onboarding** — copy-level reframe, no flow change |
| `components/onboarding/tour-steps.ts` | popover tours (Claims / Voting / Member Portal) | **sovereignty-aware tours** — copy-level reframe |
| `components/admin/evidence-export.tsx` | sealed evidence pack export to `/api/admin/evidence/export` | **evidence pack stewardship** — provenance + watermarking copy already aligned; reinforce |
| `(marketing)/solutions/procurement/page.tsx` | rich procurement narrative; consumes `institutionalRolloutPathway`, `governanceModernizationJourney`, `operationalMaturityPathway`, `governanceMaturityDimensions`, `deploymentTimelines` | **coexistence + sovereignty polish** — additive copy refinements only |
| `(marketing)/trust/*` | trust narrative surfaces | **chronology-linked trust** framing |
| `(marketing)/runtime/*` | runtime narrative surfaces | **inspectable operational posture** framing |
| `api/onboarding/discover-federation/*` | federation discovery endpoint | **federation-aware operations** — reinforce sovereignty posture in copy |

Every WS J change MUST be **additive copy / framing only** — no behaviour change, no flow
change, no schema change, no RBAC / tenancy change. The protected governance metadata fence
(`governance/protected.ts`) and IGG read-side fence remain the source of truth for what may
not surface.

## Audit answers (WS J ten-question grid)

1. **Which deployment surfaces are safe now?** All read-only marketing & dashboard copy that
   consumes `institutional-legitimacy.ts` exports, plus the onboarding wizard, evidence-export
   admin component, and federation-discovery API. They are governance-aligned by construction;
   WS J only refines the *vocabulary posture* (coexistence, sovereignty, continuity,
   explainability).
2. **Which procurement views already exist implicitly?** `(marketing)/solutions/procurement/page.tsx`
   already renders the full rollout pathway, governance journey, maturity model, and deployment
   timelines. WS J reinforces the *additive coexistence* framing and adds the procurement
   evidence binder visibility where it is currently dormant.
3. **Which onboarding semantics should become more visible?** Continuity-aware onboarding
   scenarios (`onboardingContinuityIntelligenceScenarios`) and the 5-step admin wizard.
   WS J adds copy that frames onboarding as *continuity preservation*, not *organizational
   bootstrapping*.
4. **Which evidence primitives should become visible?** `evidenceArchitecture` per-domain
   layers, `procurementEvidenceBinder` 8-item set, and the existing sealed-pack export
   (`evidence-export.tsx`). WS J frames these as **evidence provenance** and
   **chronology-linked trust** — reinforcing the existing "watermarked, tamper-proofed,
   sealed" copy.
5. **Which runtime risks could drift into surveillance / centralization?** Anything that
   frames the deployment as a "command center", "transformation platform", "all-in-one
   replacement", "AI-led governance", "centralized control", or "workforce optimization".
   WS J adds these to the forbidden vocabulary so they cannot drift in.
6. **Which framing patterns feel governance-safe?** "Coexistence", "continuity safeguards",
   "sovereignty-conscious deployment", "federation-aware operations", "explainability",
   "operational stewardship", "inspectable operational posture", "evidence provenance",
   "chronology-linked trust", "governance-safe deployment", "institutional resilience".
   Forbidden: "all-in-one", "transformation platform", "governance optimization",
   "operational command center", "AI-led governance", "platform dominance",
   "institutional monitoring", "governance automation", "centralized control",
   "workforce optimization", "organizational intelligence".
7. **Which deployment timelines are explainable?** All 5 entries of `deploymentTimelines`
   plus the 7-stage `institutionalRolloutPathway` — each carries explicit pacing copy and
   maps to procurement-readable phases.
8. **What sovereignty / federation posture should be visible?** Federation-discovery
   endpoint exists (`api/onboarding/discover-federation`); WS J adds copy that frames
   the deployment as *federation-aware*, *sovereignty-conscious*, and *coexistence-oriented*
   — not as a single-vendor platform takeover.
9. **Which procurement / runtime semantics must remain hidden?** Protected entity / event /
   decision / relationship kinds (Class B, golden share, reserved matter, vetoes, OVERRIDES,
   continuity-protection internals) — already enforced by `governance/protected.ts` and the
   IGG fence. WS J never references these.
10. **What UX patterns align with the institutional doctrine?** Phased rollout rails;
    coexistence walkthroughs; sealed evidence-pack stewardship cards; continuity-aware
    onboarding scenarios; sovereignty-aware federation copy; inspectable maturity
    snapshots (no scoring). **No** cockpits, **no** command centers, **no** scoreboards,
    **no** transformation banners.

## Existing UE surfaces that already touch this space

| Route / surface | Status | WS J relationship |
|---|---|---|
| `(marketing)/solutions/procurement/page.tsx` | Rich substrate consumer (rollout pathway, governance journey, maturity, timelines). | Primary surface. Additive copy polish only. |
| `(marketing)/trust/*` | Trust narrative pages. | Reframe with chronology-linked trust + evidence provenance vocabulary. |
| `(marketing)/runtime/*` | Runtime narrative pages. | Reframe with inspectable operational posture + governance-safe deployment vocabulary. |
| `(marketing)/institutional-continuity/page.tsx` | Consumes `organizationalTransformationPathway`. | Wrap with positive coexistence doctrine note at L165 / L371; do NOT rename the export. |
| `components/onboarding/admin-onboarding-wizard.tsx` | 5-step admin wizard (Overview / Users / Security / Integrations / Reporting). | Continuity-aware copy refinements per step; no flow / data changes. |
| `components/onboarding/tour-steps.ts` | Popover tours (Claims / Voting / Member Portal). | Sovereignty-aware copy refinements; no tour-flow changes. |
| `components/admin/evidence-export.tsx` | Sealed-pack exporter (POST `/api/admin/evidence/export`). | Reinforce evidence-provenance + chronology-linked trust framing in copy strings. |
| `api/onboarding/discover-federation/*` | Federation discovery endpoint. | API behaviour unchanged. WS J adds federation-aware copy in onboarding surfaces that consume it. |
| `lib/sovereignty/*` | Sovereignty utilities. | Behaviour unchanged. WS J references the sovereignty posture in copy. |
| `dashboard/governance-center` / `longitudinal-cognition` / `institutional-memory` / `operations` / `institutional-observability` | WS A–G surfaces. | Siblings. Untouched. |

WS J does **not** introduce a new route family. It is a **convergence pass** across the
existing trust / procurement / runtime / onboarding / evidence surfaces.

## WS J convergence surfaces (proposed, additive copy only)

| Surface | Current shape | WS J additive change |
|---|---|---|
| **Procurement marketing page** | Already consumes rollout / journey / maturity / timelines substrate. | Add coexistence preamble, sovereignty-paced deployment note, federation-aware operations callout, evidence-binder visibility section (consumes `procurementEvidenceBinder`). |
| **Trust marketing pages** | Trust narrative copy. | Reframe with **chronology-linked trust** + **evidence provenance** vocabulary; add explainability strip. |
| **Runtime marketing pages** | Runtime narrative copy. | Reframe with **inspectable operational posture** + **governance-safe deployment** vocabulary; add operational stewardship strip. |
| **Institutional continuity page** | Consumes `organizationalTransformationPathway`. | Wrap consumption with a positive coexistence doctrine note (L165 phrase already softened; L371 header to soften additively). |
| **Admin onboarding wizard** | 5 steps (Overview / Users / Security / Integrations / Reporting). | Per-step copy reframe: continuity-aware onboarding, sovereignty-conscious deployment, federation-aware integrations, explainability-first reporting. |
| **Onboarding tour steps** | Popover descriptions. | Per-tour copy reframe: sovereignty-aware claims tour, continuity-aware voting tour, federation-aware member-portal tour. |
| **Evidence-export admin component** | "Sealed", "watermarked", "tamper-proofed", "audit & compliance". | Add **evidence provenance** + **chronology-linked trust** wording; keep all behaviour identical. |

### Visual / language direction

- **Visual:** unchanged — no new components, no new layouts, no new charts.
- **Language:** "coexistence" / "continuity safeguards" / "sovereignty-conscious deployment"
  / "federation-aware operations" / "explainability" / "operational stewardship" /
  "continuity-aware onboarding" / "governance-safe deployment" / "institutional resilience"
  / "inspectable operational posture" / "evidence provenance" / "chronology-linked trust"
  — the WS J ontology, layered additively over WS A–G/I.

### Behaviour posture

WS J does **not** modify any handler, schema, RBAC check, tenancy boundary, deployment model,
onboarding flow, procurement system, or evidence schema. Every change is copy-level or
narrative-governance-config-level. The federation-discovery API, sealed-pack export, and
admin wizard flow remain byte-identical at the behaviour layer.

## Part H — protected-governance exposure audit

| Risk vector | Status |
|---|---|
| Class-B / golden-share references in copy | Not introduced. WS J copy references only "coexistence", "continuity", "sovereignty", "federation", "explainability", "evidence provenance". |
| Veto / reserved-matter exposure | Not introduced. Procurement / runtime copy makes no reference to protected governance internals. |
| `OVERRIDES` lineage exposure | Not possible — WS J does not consume IGG lineage at all; substrate is `institutional-legitimacy.ts` static copy exports. |
| Continuity-protection internals | Not introduced. Continuity copy references only the public continuity ontology (succession, tenure, stewardship, ratification, breakpoint). |
| Founder-control framing | Not introduced. Already enforced by `founderOptics` block. |
| Transformation / command-center framing | Newly fenced by `wsjTrustProcurementRuntime` forbidden-vocabulary group (Part J below). |

## Part J — narrative-CI vocabulary additions

To prevent regression as procurement / runtime / trust / onboarding copy converges:

### Hard-fails (`wsjTrustProcurementRuntime` group)

- "all-in-one replacement"
- "transformation platform"
- "governance optimization"
- "operational command center"
- "AI-led governance"
- "organizational intelligence"
- "platform dominance"
- "institutional monitoring"
- "governance automation"
- "centralized control"
- "workforce optimization"

### Required vocabulary additions (`WSJ_TRUST_PROCUREMENT_RUNTIME_REQUIRED`)

- "coexistence"
- "continuity safeguards"
- "sovereignty-conscious deployment"
- "federation-aware operations"
- "explainability"
- "operational stewardship"
- "continuity-aware onboarding"
- "governance-safe deployment"
- "institutional resilience"
- "inspectable operational posture"
- "evidence provenance"
- "chronology-linked trust"

### Glob extension

`apps/union-eyes/tooling/marketing/narrative-audit.ts` — `INTERNAL_NARRATIVE_GLOBS` extended
with the trust / runtime / procurement / onboarding surface globs so vocabulary drift is
caught at CI:

- `app/[locale]/(marketing)/trust/**/page.tsx`
- `app/[locale]/(marketing)/runtime/**/page.tsx`
- `app/[locale]/(marketing)/solutions/procurement/**/page.tsx`
- `components/onboarding/**/*.{ts,tsx}`
- `components/admin/evidence-export.tsx`

## Concerning grep hits and additive recommendations

Five concerning vocabulary patterns were flagged during discovery. **None require renaming
of substrate exports**. Each is resolved additively:

| Hit | Location | Recommendation |
|---|---|---|
| `organizationalTransformationPathway` symbol name | `lib/institutional-legitimacy.ts` L49; consumed by `institutional-continuity/page.tsx` L36/303–306 | **Do not rename.** Wrap consumption with positive coexistence doctrine note at the page section header (L371). The export is a *positive directional sequence* (Operational Fragmentation → Institutional Resilience); the framing makes that explicit. |
| "Operational transformation as a gradual pathway" header (L371) | `institutional-continuity/page.tsx` | Soften to "Operational continuity as a gradual, governance-safe pathway" or similar additive reframe. |
| Procurement page "Build confidence through phased, governable deployment" (already strong) | `(marketing)/solutions/procurement/page.tsx` | Reinforce with coexistence preamble; no rewrite. |
| Evidence-export copy ("sealed", "watermarked", "tamper-proofed") | `components/admin/evidence-export.tsx` | Already governance-aligned. Add **evidence provenance** + **chronology-linked trust** framing in section copy. |
| Admin wizard step labels (Overview / Users / Security / Integrations / Reporting) | `components/onboarding/admin-onboarding-wizard.tsx` | Step *labels* unchanged (deterministic UI). Step *descriptions* reframed with continuity-aware / sovereignty-conscious / federation-aware / explainability-first vocabulary. |

## Acceptance gates

- `pnpm narrative:audit` — maturity ≥ 85, hard-fail = 0
- `pnpm narrative:check --ci` — green
- `pnpm typecheck` — full graph clean
- `pnpm --filter @nzila/union-eyes test` — evidence-export tests green if touched
  (`apps/union-eyes/lib/__tests__/evidence-export.test.ts`)

## Out-of-scope (deferred to focused later workstreams)

- Real federation-handshake protocol implementation (only the discovery endpoint exists today;
  WS J reinforces *posture*, not *protocol*).
- Sovereignty-policy engine (only library utilities exist today; WS J reinforces *language*,
  not *enforcement*).
- Procurement-system integration with external e-procurement vendors (out of scope; WS J is
  internal narrative convergence).
- Onboarding-wizard flow changes (steps, fields, validation) — explicitly forbidden by the
  WS J fence.
- Evidence-schema changes — explicitly forbidden by the WS J fence.
- Deployment-model rewrites (single-tenant / multi-tenant / federated) — explicitly forbidden
  by the WS J fence.
- Bilingual copy lockstep on the new strings (will land in a focused i18n pass).
