# Wave 6 — Institutional Inevitability Refinement

> Audited surface: `apps/union-eyes`
> Branch: `feat/trustcore-trust-ops-v1`
> Wave 5 review: [`wave5-institutional-refinement-review.md`](./wave5-institutional-refinement-review.md)

Wave 6 closes the experiential loop. The runtime topology, governance
contracts, monetization model, and canonical ontology established by
Waves 1–5 are now atmospherically reinforced: sovereignty surfaces
*feel* sovereign before any business logic loads, the marketing
platform overview is the singular institutional ontology surface, and
the eight-pillar topology is no longer competing with parallel marketing
variants for the same semantic ground.

This wave intentionally privileges **experiential refinement over
structural change**. No new modules, no expanded runtime topology, no
speculative capabilities — only refinement of cadence, posture,
language, and atmosphere against the live runtime.

## Sovereignty atmosphere refinement results

A new server component `components/sovereignty/sovereignty-posture-banner.tsx`
is rendered above `children` in every sovereignty-gated dashboard
layout. The banner communicates four institutional facts before any
authoritative content paints:

1. The surface name and that it belongs to the sovereignty layer.
2. The role contract enforced by the layout (e.g. *Officer of record*).
3. A one-line operational posture describing the institutional
   responsibility a viewer accepts by being on this surface.
4. That access is logged and that actions taken here are part of the
   institutional record.

| Layout                                              | Min role        | Posture (one line)                                                                                  |
|-----------------------------------------------------|-----------------|-----------------------------------------------------------------------------------------------------|
| `dashboard/cognition/layout.tsx`                    | `system_admin`  | Bounded reasoning over institutional memory; outputs are recommendations for the reviewer of record |
| `dashboard/longitudinal-cognition/layout.tsx`       | `system_admin`  | Cross-time institutional reasoning; review continuity-relevant patterns before any escalation       |
| `dashboard/security/layout.tsx`                     | `admin`         | Continuity-critical configuration; changes are part of the institutional audit trail                |
| `dashboard/customer-success/layout.tsx`             | `admin`         | Institutional account stewardship; reviewer-of-record discipline                                    |
| `dashboard/operations/layout.tsx`                   | `officer`       | Operational cadence and dispatch; reviewer of record for institutional execution                    |
| `dashboard/ops/layout.tsx`                          | `system_admin`  | Sovereignty-layer runtime controls; every action is logged and continuity-affecting                 |

Effect: a steward, officer, or sovereignty operator can no longer
arrive on these surfaces and read them as "advanced dashboards." The
banner makes the institutional contract legible at first paint.

## Cadence embodiment results

The canonical eight-pillar overview at `/platform` continues to anchor
cadence around **Priorities** as one of the eight first-class surfaces
("Operational cadence and commitments — institutions operate on
rhythms, not menus"). Wave 6 reinforces this by collapsing the
`operational-coherence` marketing variant into `/platform#priorities`
(see *Platform ontology collapse* below), so the cadence story is told
in exactly one place.

Operational cadence remains expressed at the runtime level by:

- The canonical `/dashboard/operations` surface (gated at `officer`,
  banner: *"Operational cadence and dispatch"*).
- The preserved `/dashboard/dispatch` and `/dashboard/support` drilldowns
  for active dispatch and stewardship cadence.
- The canonical `/dashboard/priorities` surface as the steward / member
  cadence entry point (out-of-scope for Wave 6 structural changes).

## Executive calmness results

Executive collapse was completed structurally in Wave 5 (two parallel
intelligence variants converted to redirect shims into
`/dashboard/intelligence?tab=…`). Wave 6 reinforces calmness *atmospherically*:

- The `executive-operating-intelligence` drilldown now renders a
  sovereignty banner naming the executive as **"Sovereignty operator of
  record"** with explicit posture framing before any business widgets.
- No additional executive surfaces were created. The runtime now
  presents executives with **one canonical entry** plus a small set of
  named, role-gated drilldowns — replacing the pre-Wave-5 fan-out of
  five parallel intelligence routes.

## Procurement atmosphere results

The `/platform` overview (Wave 4) remains the canonical procurement
narrative. Wave 6 strengthens procurement atmosphere by:

- **Eliminating the four parallel `/platform/*` marketing variants**
  (governance-intelligence, organizational-memory, operational-coherence,
  explainable-intelligence) so a procurement reviewer who lands on any
  of those legacy URLs is delivered to the corresponding pillar anchor on
  the canonical eight-pillar page rather than to a parallel marketing
  surface that competes with it semantically.
- **Preserving SEO continuity** via 307 server redirects (Next.js
  `redirect()` from a Server Component returns a temporary redirect by
  default), which retains link equity until the canonical overview has
  fully absorbed inbound traffic and a permanent redirect can be
  introduced in a later sweep.
- **Not introducing new CTA pressure**: the canonical `/platform` page's
  single closing CTA points at the operational maturity programs page —
  there is no marketing energy added by this wave.

## Platform ontology collapse results

| Variant route                                       | Wave 6 disposition                | Canonical destination                          |
|-----------------------------------------------------|------------------------------------|------------------------------------------------|
| `/platform/governance-intelligence`                 | Server redirect shim (307)         | `/platform#governance`                         |
| `/platform/organizational-memory`                   | Server redirect shim (307)         | `/platform#institutional-memory`               |
| `/platform/operational-coherence`                   | Server redirect shim (307)         | `/platform#priorities`                         |
| `/platform/explainable-intelligence`                | Server redirect shim (307)         | `/platform#trust`                              |
| `/platform/executive-intelligence`                  | Did not exist                      | n/a (already absorbed by `/platform#intelligence`) |

`/platform` is now **the singular institutional ontology surface**.
There is no remaining marketing route that competes with it for
semantic ground.

Selective preservation reasoning: each variant was a single marketing
page with no unique runtime contract, no role gate, and no inbound deep
links from runtime components (verified by repository grep). 307
redirects were chosen (vs 308) to keep optionality for re-routing in a
future wave without the URL becoming permanently bound.

## Runtime pacing results

No runtime topology was added in Wave 6. The dashboard surface count
remains at 84 `page.tsx` files (77 authoritative + 7 Wave-5 redirect
shims); the marketing surface gains 4 additional Wave-6 redirect shims
under `/platform/*` for a total of 11 redirect shims across the runtime.

| Metric                                              | Pre-Wave 6 | Post-Wave 6 |
|-----------------------------------------------------|-----------:|------------:|
| Dashboard `page.tsx` files                          | 84         | 84          |
| Dashboard authoritative `page.tsx` files            | 77         | 77          |
| Dashboard redirect-shim `page.tsx` files            | 7          | 7           |
| `/platform/*` authoritative pages                   | 5          | 1 canonical |
| `/platform/*` redirect-shim pages                   | 0          | 4           |
| Sovereignty-banner-bearing dashboard layouts        | 0          | 6           |
| Sovereignty-gated dashboard layouts                 | 6          | 6           |

## Stakeholder emotional clarity review

| Stakeholder lane             | Pre-Wave 6 framing                                  | Post-Wave 6 framing                                                              |
|------------------------------|------------------------------------------------------|----------------------------------------------------------------------------------|
| Steward / officer            | Canonical work + operations surfaces, unframed       | Same surfaces; operations now explicitly framed as *officer of record*           |
| Executive (president +)      | One canonical intelligence surface                   | Same; executive-operating drilldown framed as *sovereignty operator of record*   |
| Sovereignty operator         | Six gated layouts with no posture surface            | Six gated layouts that *name* the sovereignty contract before any content        |
| Governance reviewer          | Canonical `/dashboard/governance` officer-gated      | Same; cross-link discipline preserved                                            |
| Procurement reviewer         | Canonical `/platform` overview + 4 competing variants | One canonical `/platform` overview; variants redirect to anchored pillars        |

Each lane now has an unambiguous, explicit operational identity.

## Continuity-language finalization review

The sovereignty banner uses continuity-safe language exclusively:
*sovereignty layer, reviewer of record, institutional record,
continuity-critical, continuity-relevant patterns, institutional
audit trail, reviewer-of-record discipline, continuity-affecting*.

There is **no** SaaS, productivity, optimization, or AI-hype framing
in the new banner copy. It speaks one institutional language system
consistent with the doctrine alignment sweep
(see [`full-doctrine-alignment-sweep.md`](./full-doctrine-alignment-sweep.md)).

A broader sweep of remaining marketing copy (trust center, pricing
page narrative, pilot-request flow) is the natural next wave's
responsibility — Wave 6 normalizes the language at the highest-
sensitivity surfaces (sovereignty layouts) where the cost of a
mismatched register is greatest.

## Remaining deferred refinement items

1. **Pricing / trust-center copy refinement** — operational honesty
   wording sweep across procurement marketing surfaces. Deferred
   because the existing pages were rebuilt in Wave 4 on the operational
   maturity model and are already substantially continuity-framed.
2. **`/platform/*` permanent (308) redirects** — current 307 temporary
   redirects preserve future routing optionality; promote to permanent
   once analytics confirm the canonical overview has absorbed inbound
   traffic.
3. **Cross-link discipline on canonical intelligence shell** — a named,
   first-class link from `/dashboard/intelligence` into
   `/dashboard/movement-insights` would further reduce ambiguity for
   federation-scope viewers (carried over from Wave 5).
4. **Stakeholder-lane copy review** in `lib/dashboard/role-experience.ts`
   to ensure each lane's name, tagline, and CTA copy matches the
   continuity-safe register established by the sovereignty banners.

## Final verdicts

| Verdict area                       | Verdict          | Reasoning                                                                                                              |
|------------------------------------|------------------|------------------------------------------------------------------------------------------------------------------------|
| Sovereignty embodiment             | **GO**           | Six gated layouts now carry posture banners; institutional contract is legible at first paint                          |
| Cadence embodiment                 | **GO**           | Canonical Priorities pillar + Operations gate + dispatch / support drilldowns; cadence is told in one place            |
| Executive calmness                 | **GO**           | One canonical intelligence entry; executive-operating drilldown framed by sovereignty banner                           |
| Procurement calmness               | **GO**           | Canonical `/platform` is the singular institutional ontology surface; 4 parallel variants collapsed                    |
| Operational pacing                 | **GO**           | No runtime topology added; dashboard density unchanged; banner reduces visual ambiguity rather than adding density     |
| Runtime coherence                  | **GO**           | Sovereignty surfaces now carry their contract atmospherically; canonical entry points are unambiguous                  |
| Stakeholder emotional clarity      | **GO**           | Each lane has an explicit operational identity; sovereignty roles are named at runtime                                 |
| Institutional inevitability        | **CONDITIONAL GO** | Atmosphere is in place at the highest-sensitivity surfaces; the broader copy / pricing / trust-center sweep remains a Wave 7 deliverable before unconditional inevitability can be claimed across the full procurement journey |
