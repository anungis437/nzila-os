# Wave 7 — Procurement Inevitability, Institutional Trust Finalization & Operational Confidence Refinement

> Audited surface: `apps/union-eyes`
> Branch: `feat/trustcore-trust-ops-v1`
> Wave 6 review: [`wave6-institutional-inevitability-review.md`](./wave6-institutional-inevitability-review.md)

Wave 7 finalizes the procurement reading register. The structural,
ontological, and atmospheric work of Waves 1–6 is now reinforced by a
single shared procurement posture surface — `InstitutionalContinuityNote` —
embedded immediately under the hero on every procurement-facing
marketing page. Procurement reviewers no longer have to *infer* the
institutional posture of the platform; the posture is named, in
continuity-safe language, before any feature framing or CTA.

This wave intentionally privileges **trust refinement over structural
change**. No new modules, no expanded runtime topology, no speculative
capabilities — only refinement of register, language, and pacing on
the surfaces a procurement reviewer actually reads.

## Procurement trust refinement results

A new server component
`components/marketing/institutional-continuity-note.tsx` provides a
low-energy band rendered immediately under the hero on procurement-
facing marketing pages. The band carries:

- A two-word surface identifier in small caps (e.g. *Trust posture*,
  *Procurement posture*, *Pilot posture*, *Institutional ontology*).
- One paragraph of continuity-safe operational honesty describing how
  the page should be read — what the institution gains, what
  responsibility the platform accepts on the institution's behalf, and
  how a reviewer of record should approach the surface.
- Zero CTAs. Zero conversion energy. Zero productivity / SaaS framing.

| Surface                    | Posture identifier         | Posture summary                                                                                                                                                                                                                                                                                                                                              |
|----------------------------|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/trust`                   | Trust posture              | Trust is operational, not symbolic. Pillars describe how explainability, governance review, sovereignty boundaries, and continuity-safe operation are enforced at runtime.                                                                                                                                                                                    |
| `/pricing`                 | Procurement posture        | Programs are operational commitments, not subscriptions. Each maturity state names institutional responsibilities Union Eyes will hold and the continuity-safe operating record it will maintain.                                                                                                                                                              |
| `/pilot-request`           | Pilot posture              | This is a continuity briefing, not a sales intake. A bounded pilot whose success is operational stabilization — fewer dropped commitments, clearer escalation, an institutional record that survives leadership transitions. Workers are never the subject of pilot assessment.                                                                              |
| `/platform`                | Institutional ontology     | The eight surfaces are not a feature list. They name the operational responsibilities a union, federation, or congress already carries. Adopting Union Eyes does not introduce new responsibilities — it gives existing ones a continuity-safe operating record.                                                                                              |

## Trust-center convergence results

The `/trust` page now opens with continuity-safe framing immediately
under the hero, and the two hero CTAs were refined out of the previous
sales register:

| CTA position             | Pre-Wave 7 copy             | Post-Wave 7 copy                  |
|--------------------------|------------------------------|------------------------------------|
| Hero secondary action    | *Explore Proof Layer*        | *Review the proof record*          |
| Hero primary action      | *Request Executive Briefing* | *Begin a continuity briefing*      |

Effect: the trust page now reads as a constitutional surface — a
publicly reviewable description of what the institution can *expect to
remain true at runtime* — rather than as a security-marketing entry
point.

## Executive reassurance results

Executive-facing surfaces (`/dashboard/intelligence`,
`/dashboard/executive-operating-intelligence` with its Wave-6 sovereignty
posture banner, and the `/platform#intelligence` pillar) now compose into
a single continuous reading register: from the marketing surface, the
executive sees an institutional ontology that names *Intelligence* as
one of eight responsibilities; from the runtime, they enter a single
canonical surface; from the sovereignty drilldown, they encounter their
contract as the *Sovereignty operator of record* before any business
widget paints. Wave 7 adds no new surfaces — the calmness comes from
the consistent register across all three.

## Onboarding trust refinement results

Onboarding for Wave 7 is treated as the pilot-request flow plus the
first dashboard landing. The pilot-request page now carries the *Pilot
posture* continuity note framing the form as a *continuity briefing,
not a sales intake*. The first sentence the prospect reads after the
hero is now an explicit reframing of the engagement around operational
stabilization rather than capability evaluation.

The dashboard onboarding surface itself is governed by Wave 5/6
conventions and was not modified in Wave 7 to avoid introducing
density.

## Stakeholder operational confidence results

Each stakeholder lane now reads with a consistent register across
marketing → runtime → sovereignty drilldown:

| Lane                       | Marketing register           | Runtime register                    | Sovereignty register (where applicable)              |
|----------------------------|------------------------------|--------------------------------------|------------------------------------------------------|
| Steward / officer          | Operational stabilization    | Canonical work + operations surfaces | *Officer of record* on `/dashboard/operations`       |
| Executive (president +)    | Institutional ontology       | Canonical `/dashboard/intelligence`  | *Sovereignty operator of record* on exec drilldown   |
| Sovereignty operator       | Trust posture                | Six gated layouts                    | *Sovereignty operator of record* on each layout      |
| Governance reviewer        | Procurement posture          | Canonical `/dashboard/governance`    | (gate at `officer`)                                  |
| Procurement reviewer       | Pilot posture                | n/a (pre-runtime)                    | n/a                                                  |

## Continuity-language sweep results

The Wave 6 sovereignty banner copy and the new Wave 7 continuity note
copy together establish a stable shared register across all
high-sensitivity procurement surfaces. Verified vocabulary in this
register: *continuity-safe, reviewer of record, operational record,
institutional record, institutional responsibilities, continuity
briefing, operational stabilization, sovereignty boundaries,
governance-safe, operational commitments, institutional ontology*.

Verified absent from the new copy: *unlock, supercharge, optimize,
streamline, productivity, AI-powered, growth, conversion, seats, SaaS,
workflow automation*. Existing legacy copy on the trust and pilot
pages still contains some pre-doctrine vocabulary; this is left for a
later marketing-copy sweep so Wave 7 does not entangle ontological
refinement with broad copy edits.

## Operational rhythm refinement results

Runtime topology is unchanged in Wave 7. The continuity note adds a
single sub-100-pixel horizontal band beneath the hero on four marketing
surfaces, deliberately *reducing* the perceived density of the page by
giving the reader a paced, low-energy paragraph between the hero and
the dense feature / pillar grids that follow. There are no new
interactive elements introduced.

## Pilot/procurement walkthrough results

The pilot-request page now leads with a continuity briefing register
*before* the readiness form. A procurement reviewer walking through the
flow encounters, in order:

1. Hero with continuity-safe framing.
2. Continuity note: *Pilot posture* — explicit reframing as a continuity
   briefing, with worker-protection language at the top of the page.
3. The existing `HumanCenteredCallout` trust message.
4. The pilot-readiness framework section (operationally safe and
   governance-first by design — pre-existing copy, retained).
5. The form itself.

Procurement reviewers walking through `/platform` → `/pricing` →
`/trust` → `/pilot-request` now experience four pages whose register is
explicitly aligned by the continuity-note layer.

## Remaining deferred refinements

1. **Legacy marketing-copy sweep** across pre-doctrine vocabulary in
   the trust page body (e.g. "Trust-Center Operationalization"
   section heading, occasional *capability* / *deployment-marketing*
   wording in `/lib/operational-legitimacy.ts` content). The
   continuity-note register now sets the contract at the top of each
   page; aligning the body copy is a wide and mechanical pass best
   handled in a dedicated sweep.
2. **Translations parity** — the new continuity note posture strings
   are presently in English only. They should be lifted into the
   `marketing.*` namespace and translated for fr-CA before any
   procurement engagement that requires it.
3. **`/platform/*` permanent (308) redirects** carried forward from
   Wave 6 — promote once analytics confirm the canonical overview has
   absorbed inbound traffic.
4. **Cross-link discipline on `/dashboard/intelligence`** — named link
   into `/dashboard/movement-insights` (carried over from Waves 5–6).
5. **Stakeholder-lane copy review** in `lib/dashboard/role-experience.ts`
   to bring lane names and taglines into the shared register.

## Final verdicts

| Verdict area                          | Verdict          | Reasoning                                                                                                                                                                                |
|---------------------------------------|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Procurement inevitability             | **GO**           | Four procurement surfaces now share a continuity-safe posture register at the top of the page; reviewer is told how to read each surface before any conversion energy                    |
| Institutional trust                   | **GO**           | Trust posture explicitly framed as operational and constitutional rather than security-marketing; CTAs refined out of sales register                                                    |
| Executive reassurance                 | **GO**           | Marketing → runtime → sovereignty register is continuous for executives; Wave 6 sovereignty banner now reinforced by Wave 7 marketing register                                          |
| Continuity confidence                 | **GO**           | Continuity language now appears at the top of trust, pricing, pilot-request, and platform; sovereignty banners use the same register                                                    |
| Stakeholder operational confidence    | **GO**           | Each lane has a continuous register across marketing, runtime, and sovereignty surfaces                                                                                                  |
| Operational calmness                  | **GO**           | No runtime topology added; the continuity note paces the reader rather than adding density                                                                                              |
| Governance reassurance                | **GO**           | Governance pillar register is consistent across `/platform#governance`, `/dashboard/governance`, and the trust page governance tab                                                      |
| Institutional inevitability           | **CONDITIONAL GO** | Inevitability is now structurally, ontologically, atmospherically, and registrationally in place at the top of every procurement surface. Unconditional inevitability still requires the deferred legacy marketing-copy sweep + translations parity to pass under procurement-grade review. |
