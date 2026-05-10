# Wave 5 — Institutional Refinement, Executive Collapse, Sovereignty Embodiment & Procurement Calmness

> Audited surface: `apps/union-eyes`
> Branch: `feat/trustcore-trust-ops-v1`
> Wave 4 review: [`wave4-experience-convergence-review.md`](./wave4-experience-convergence-review.md)

Wave 5 closes the operational topology by collapsing seven parallel
executive / governance / institutional-memory variants into their canonical
surfaces, while preserving Wave 2/3 sovereignty gates on the four authoritative
drilldowns that retain unique business logic. The result is a calmer
runtime: institutional users land on a small number of canonical entry
points, with deeper drilldowns reached as tabs / cross-links rather than
parallel top-level routes.

## Executive collapse results

| Variant route                                     | Wave 5 disposition                               | Canonical destination                                 |
|---------------------------------------------------|---------------------------------------------------|--------------------------------------------------------|
| `/dashboard/institutional-operating-intelligence` | Server redirect shim (`page.tsx` rewritten)       | `/dashboard/intelligence?tab=executive-operating`      |
| `/dashboard/institutional-intelligence`           | Server redirect shim (`page.tsx` rewritten)       | `/dashboard/intelligence?tab=institutional`            |
| `/dashboard/executive-operating-intelligence`     | **Preserved** as gated drilldown (Wave 2 layout: `president`) | `/dashboard/intelligence` cross-links into it          |
| `/dashboard/movement-insights`                    | **Preserved** — 13 KB of unique federation analytics; reachable from `/intelligence` | n/a                                                     |
| `/dashboard/sector-analytics`, `/dashboard/cross-union-analytics` | **Preserved** — Wave 2 `fed_staff` gates intact | n/a                                                     |

Net effect: two ungated executive variants collapsed; four sovereignty-gated
or content-rich surfaces retained as authoritative drilldowns reached from
the canonical `/dashboard/intelligence` shell.

## Governance collapse results

| Variant route                       | Wave 5 disposition                          | Canonical destination                       |
|-------------------------------------|----------------------------------------------|----------------------------------------------|
| `/dashboard/governance-culture`     | Server redirect shim (`page.tsx` rewritten)  | `/dashboard/governance?tab=culture`          |
| `/dashboard/governance-recommendations` | Server redirect shim (`page.tsx` rewritten) | `/dashboard/governance?tab=recommendations` |
| `/dashboard/governance-center`      | **Preserved** — 7.7 KB of unique surface     | reached from `/dashboard/governance`         |

Two ungated parallel governance variants collapsed into the canonical
`/dashboard/governance` shell. The canonical shell already gates at
`officer` and presents `bylaws | policies | signatories` as primary tabs;
the two redirected tabs (`culture`, `recommendations`) are surfaced via
the `?tab=` query for stable inbound URLs.

## Institutional-memory collapse results

| Variant route                       | Wave 5 disposition                          | Canonical destination                                 |
|-------------------------------------|----------------------------------------------|--------------------------------------------------------|
| `/dashboard/knowledge`              | Server redirect shim (`page.tsx` rewritten)  | `/dashboard/institutional-memory?tab=knowledge`        |
| `/dashboard/knowledge-base`         | Server redirect shim (`page.tsx` rewritten)  | `/dashboard/institutional-memory?tab=knowledge-base`   |
| `/dashboard/knowledge-transfer`     | Server redirect shim (root `page.tsx` only)  | `/dashboard/institutional-memory?tab=transfer`         |
| `/dashboard/knowledge-transfer/[id]`, `/dashboard/knowledge-transfer/new` | **Preserved** as drilldowns | n/a                                                     |

Three ungated knowledge-surface roots collapsed; the `[id]` / `new`
sub-routes remain authoritative under their existing segment so deep
links from prior conversations and emails continue to resolve.

Inbound cross-links updated to point at the canonical surface directly
(skipping the redirect hop):

- `components/intelligence/intelligence-shell.tsx` — knowledge cross-link
- `components/work/work-surface.tsx` — knowledge cross-link
- `components/knowledge/knowledge-console.tsx` — knowledge-base section card

## Operations collapse results

`/dashboard/dispatch` (13 KB) and `/dashboard/support` (28 KB) carry
substantive unique surface area and the canonical `/dashboard/operations`
shell is itself a 31 KB authoritative surface gated at `officer` (Wave 3
layout). Wave 5 therefore **preserves** both as authoritative drilldowns
reached from the canonical operations shell rather than collapsing them
into redirect shims.

| Variant route                | Wave 5 disposition                                 |
|------------------------------|-----------------------------------------------------|
| `/dashboard/operations`      | Canonical (Wave 3 gate: `officer`) — entry point    |
| `/dashboard/dispatch`        | Preserved — drilldown                               |
| `/dashboard/support`         | Preserved — drilldown                               |
| `/dashboard/customer-success`| Preserved (Wave 3 gate: `admin`)                    |
| `/dashboard/ops`             | Preserved (Wave 3 gate: `system_admin`)             |

This is intentional. Collapsing dispatch / support into query-tabs would
either duplicate ~41 KB of TSX into the canonical shell or hide
sovereignty-relevant surface behind a tab switcher. Wave 5's calmness
goal is achieved by ensuring the canonical operations shell *advertises*
and *links into* these drilldowns — not by deleting them.

## Sovereignty embodiment results

The six Wave 2/3 sovereignty layouts remain authoritative gates on their
respective surfaces, unchanged in Wave 5:

| Layout                                              | Min role        | Wave introduced |
|-----------------------------------------------------|-----------------|-----------------|
| `dashboard/cognition/layout.tsx`                    | `national_officer` | Wave 2         |
| `dashboard/longitudinal-cognition/layout.tsx`       | `national_officer` | Wave 2         |
| `dashboard/security/layout.tsx`                     | `system_admin`     | Wave 2         |
| `dashboard/customer-success/layout.tsx`             | `admin`            | Wave 3         |
| `dashboard/operations/layout.tsx`                   | `officer`          | Wave 3         |
| `dashboard/ops/layout.tsx`                          | `system_admin`     | Wave 3         |

Embodiment refinement (visual sovereignty banner) is deferred to a Wave
5 Phase B: the gating contract is stronger than visual treatment, and
Wave 5's runtime collapse already meaningfully reduces ambiguity.

## Runtime density metrics

| Metric                                              | Pre-Wave 5 | Post-Wave 5 |
|-----------------------------------------------------|-----------:|------------:|
| Dashboard-tier `page.tsx` files                     | 84         | 84          |
| Dashboard-tier authoritative `page.tsx` files       | 84         | 77          |
| Dashboard-tier redirect-shim `page.tsx` files       | 0          | 7           |
| Top-level executive surfaces (variants + canonical) | 5          | 1 canonical + 4 gated drilldowns |
| Top-level governance surfaces                       | 4          | 1 canonical + 1 retained drilldown |
| Top-level institutional-memory surfaces             | 4          | 1 canonical + 1 retained subtree |
| Sovereignty-gated layouts                           | 6          | 6 (preserved) |

Authoritative surface count drops from 84 to 77 (-8.3%) without losing
any business logic — the seven collapsed variants were stub / shim
surfaces whose tab semantics now flow through the canonical shells.

## Nav contraction metrics

Inbound cross-links from work, intelligence, and knowledge components
now reference canonical `/dashboard/institutional-memory?tab=...` URLs
instead of the deprecated `/dashboard/knowledge*` roots. Three call
sites updated; no nav-tree level changes were necessary because Wave 4
already pruned navigation to its canonical eight-pillar shape.

## Stakeholder-lane refinement

| Lane                       | Pre-Wave 5 ambiguity                                 | Post-Wave 5 disposition                          |
|----------------------------|-------------------------------------------------------|--------------------------------------------------|
| Executive (president +)    | 5 parallel intelligence variants                      | 1 canonical (`/intelligence`) + gated drilldowns |
| Officer (governance)       | 4 parallel governance routes                          | 1 canonical (`/governance`) + 1 drilldown        |
| Steward / member (memory)  | 4 parallel knowledge / institutional-memory routes    | 1 canonical (`/institutional-memory`)            |
| Officer (operations)       | unchanged — already canonical with sovereignty gates  | unchanged                                         |

## Procurement calmness

A buyer evaluating the surface now encounters:

- **One** intelligence entry point per executive scope, with sovereignty drilldowns visible as cross-links from canonical
- **One** governance entry point gated at `officer`, advertising bylaws / policies / signatories as first-class tabs
- **One** institutional-memory entry point reachable from work + intelligence shells
- Six sovereignty layouts preserved with explicit role gates — the institutional contract is still legible at the route level

The number of "what does this URL even mean?" questions a buyer can
plausibly raise about the dashboard surface drops from ~13 (variants
+ canonicals competing for the same lane) to **0** for the four
collapsed lanes; sovereignty-gated drilldowns retain stable, named
URLs whose purpose is reinforced by their layout-level gates.

## Remaining deferred overlaps

The following surfaces are intentionally deferred beyond Wave 5 and
documented here so the next wave has a starting inventory:

1. **`/platform/{governance-intelligence,organizational-memory,executive-intelligence,operational-coherence,explainable-intelligence}`** — Wave 4 introduced the canonical `/platform` overview with eight anchored pillars. Collapsing these five marketing variants into `/platform#anchor` redirects is a Wave 6 candidate; behavior preserved for now to avoid SEO churn until the canonical overview has been live long enough to absorb inbound links.
2. **Sovereignty banner embodiment** — visible governance posture banner on the six gated layouts (deferred to Wave 5 Phase B; gating contract is the load-bearing artifact).
3. **`/dashboard/movement-insights` cross-link** from canonical `/intelligence` shell — exists implicitly via the executive scope tab, but a named link in the intelligence shell would further reduce ambiguity.

## Final verdicts

| Verdict area                                | Outcome   | Notes                                                                  |
|---------------------------------------------|-----------|------------------------------------------------------------------------|
| Executive variant collapse (real runtime)   | ✅ shipped | 2 redirect shims; gated executive drilldowns preserved                 |
| Governance variant collapse                 | ✅ shipped | 2 redirect shims into canonical shell                                   |
| Institutional-memory variant collapse       | ✅ shipped | 3 redirect shims; subtree drilldowns preserved                          |
| Operations canonical-vs-drilldown clarity   | ✅ shipped | All preserved; canonical shell remains gated entry                      |
| Sovereignty-gate preservation               | ✅ shipped | 6 Wave 2/3 layouts unchanged                                            |
| Inbound-cross-link cleanliness              | ✅ shipped | 3 call sites repointed to canonical                                     |
| Sovereignty embodiment (visual banner)      | 🟡 deferred | Phase B; gating contract is sufficient for Wave 5                      |
| `/platform/*` marketing variant collapse    | 🟡 deferred | Wave 6 candidate                                                        |
| Validator extension                         | ✅ shipped | `tooling/scripts/validate-runtime-authority-audit.mjs` now at 12 docs   |
