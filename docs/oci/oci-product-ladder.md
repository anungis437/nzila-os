# OCI Product Ladder

**ARTIFACT TYPE:** Doctrine
**DOCTRINE_VERSION:** 1.1.0
**STATUS:** Canonical — one ladder, one price table. Supersedes all earlier pricing language,
including any prior version of this file, `README.business.md` figures, and any commercial deck
that has not yet been updated to match.

**OCI is a facilitator-led practice that helps an institution see and protect the knowledge it
depends on, without scoring the people who hold it.** See [`OCI_METHOD.md`](./OCI_METHOD.md) §6.1
for why that sentence replaces the old "not SaaS / not governance software / not an assessment
vendor" ban-list — OCRA is plainly an assessment, and OCI Runtime is plainly a hosted system.

This document is the canonical reference for the five-layer product ladder and its pricing. All
marketing copy, all pricing surfaces, all tier definitions, and all engineering work converge to
this doctrine. **This document is the one owner of prices — not the other way around.** The
numbers below were set to match the Nzila Ventures business plan submitted for financing
(`infotech/Nzila Ventures Business Plan — Revised (August 26, 2026).docx`) as it stood on 26 Aug
2026, so the two did not contradict each other at the moment of this collapse. That plan is a
dated snapshot of this table, not a second source; its own cover page says so. If the two ever
drift apart again, this document governs and the plan is stale until updated.

## The five layers

| Layer | Product | Method phase (see [OCI Method](./OCI_METHOD.md)) |
|---|---|---|
| **P1** | OCRA — the Recognition-phase assessment | Recognition |
| **P2** | Governance Entropy Workbook™ | Mapping |
| **P3** | OCI Diagnostic & Stabilization | Stabilization |
| **P4** | OCI Runtime (Platform Activation) | Infrastructure |
| **P5** | OCI Intelligence Network | Intelligence — not sold (see below) |

P1–P3 are commercially active. P4 is the post-diagnostic annual platform. P5 is an architectural
commitment, not a shipping product — see [`OCI_METHOD.md` §6.5](./OCI_METHOD.md#65-p5-intelligence-network-gate).

## Canonical pricing

One price table. No SKU below claims an outcome outside its own phase. Ranges are replaced by a
named scope driver, per engagement, never "from."

| Tier | Price (CAD) | Phase | Delivery | Scope driver |
|---|---|---|---|---|
| Free Readiness Check | Free | Recognition (start) | Self-serve, pseudonymous, instant | — |
| Leadership Briefing Report | **$1,200** | Recognition | Self-serve checkout, PDF | — |
| Full Diagnostic & Action Plan | **$6,500** | Recognition → Mapping | Facilitated, one executive workshop | 100% of this fee applies as a credit toward the OCI Assessment if upgraded within 90 days |
| **OCI Assessment** (built on OCRA, P1) | **$18,000 base**, ceiling **$45,000** | Mapping → Stabilization | Facilitated engagement, scope fixed with executive + procurement | Bargaining units / sites in scope |
| Platform Activation (OCI Runtime) | **$40,000/year base**, ceiling **$140,000/year** | Infrastructure | Annual subscription, post-Assessment | Bargaining units / sites in scope |
| Longitudinal Continuity Support | Bespoke — scope confirmed in writing before any fee is proposed | Infrastructure → Intelligence | Stewardship tier for federations / national unions | Named in the engagement scope document, never advertised as a range |

Self-serve tiers (Free, $1,200, $6,500) cannot claim Phase 3–5 outcomes. They produce a document;
they do not stabilise anything, ratify a continuity plan, or embed infrastructure. Only a
facilitated OCI Assessment or later tier may claim Stabilization-phase or Infrastructure-phase
results.

**Named conflict, closed.** The BDC business plan describes the $1,200 Leadership Briefing Report
as covering "governance entropy, continuity debt, dependency review" — Continuity Debt™ is a P3,
Stabilization-phase, facilitated-only instrument (see `docs/oci/superseded/stabilization/OCI_CONTINUITY_DEBT.md`).
The $1,200 tier does not compute Continuity Debt™. That phrase in the plan is a labelling error
inherited from an earlier draft, not a claim this doctrine backs — the deliverable at that price
point is a Recognition/Mapping-phase reading only.

**On "OCRA Intelligence."** Earlier commercial language named a separate $27,000–$36,000 tier
between the Assessment and Platform Activation. That tier is retired — its scope is inside the
$18,000–$45,000 Assessment band via the same scope driver. One priced instrument per phase.

## P5 — Intelligence Network (not sold)

P5 is reserved for anonymised, opt-in, non-ranked sector patterns once enough institutions have
completed an Assessment. **Constraint (canonical, binding):** P5 is opt-in, non-ranked, produces no
per-institution identification, and is **not sold** until two completed paid engagements exist and
a second certified facilitator is active (see [`OCI_METHOD.md` §6.5](./OCI_METHOD.md#65-p5-intelligence-network-gate)
and the [Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)).

Forward-compatibility hooks already landed so future benchmarking does not require retroactive
consent re-collection: `workbooks.sectorBand`, `workbooks.institutionSizeBand` (both nullable,
voluntarily provided). No other P5 schema work is in scope until the gate above is met.

## Signature IP frameworks

Implemented in code under `apps/union-eyes/lib/oci/frameworks/` and `apps/union-eyes/lib/workbook/engines/`.
Disposition (keep / rename / cut) for each is the [Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md#instrument-disposition) — this document only names them.

| Framework | Purpose |
|---|---|
| **Continuity Burden Map** | Institutional topology of where continuity load sits. |
| **Governance Entropy Scale** | Ordinal (1–5) reading of drift between governance design and practice. |
| **Stewardship Density Index** | Institutional concentration reading — not an individual score. |
| **Continuity Survivability Matrix** | Reconstruction burden under defined breakpoint scenarios. |
| **Reconstruction Burden Index** | Institutional cost estimate of reconstructing knowledge after a break. |

## Voice and brand constraints

Calm, editorial, governance-native. Never urgent, never gamified, never productivity-coded. No
"world class," "unique," or "only platform." Stone palette only on web; Poppins (sans); PDF uses
Times (serif) headings + Helvetica (sans) body. Only deterministic, voluntarily-provided data
leaves the database — holder names and notes never sync to CRM or PDF aggregates.

## Cross-references

- [OCI Method™](./OCI_METHOD.md) — the methodology spine
- [OCI Delivery Model](./OCI_DELIVERY_MODEL.md) — the one clock
- [Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md) — instrument disposition and the P5 gate
- [`apps/union-eyes/lib/oci/frameworks/`](../../apps/union-eyes/lib/oci/frameworks/) — framework implementations

