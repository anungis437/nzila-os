# OCI Master Product Ladder

**ARTIFACT TYPE:** Doctrine
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical — supersedes all earlier pricing language

OCI (Operational Continuity Intelligence) is a continuity-native institutional
platform. It is not governance software, not a productivity tool, not an
assessment vendor, not a SaaS workspace. It exists to recognize, map,
stabilize, embed, and learn from institutional continuity.

This document is the canonical reference for the five-layer product ladder,
its commercialization, and the IP that anchors it. All marketing copy, all
pricing surfaces, all tier definitions, and all engineering work must
converge to this doctrine.

## The five layers

| Layer | Product family | Method phase (see [OCI Method](./oci-method.md)) | Posture |
|---|---|---|---|
| **P1** | ICRA — Institutional Continuity Risk Assessment | Recognition | Awakening |
| **P2** | Governance Entropy Workbook™ | Mapping | Operational cartography |
| **P3** | OCI Diagnostic | Stabilization | Facilitated reduction of continuity burden |
| **P4** | OCI Runtime Infrastructure | Infrastructure | Embedded continuity systems |
| **P5** | OCI Intelligence Network | Intelligence | Longitudinal continuity intelligence (institutional benchmarking) |

P1 and P2 are the commercially active layers. P3 is sales-led and facilitated.
P4 and P5 are architectural commitments captured here so the ladder reads
coherent and the schema, consent, and IP decisions made today remain
forward-compatible.

## Canonical pricing

All prices are flat — no ranges, no "from" pricing, no contextual midpoints.

### P1 — ICRA

| Tier | Price (CAD) | Delivery |
|---|---|---|
| Continuity Reflection | $0 | Self-serve, instant |
| Executive Continuity Brief | **$1,200** | Self-serve checkout, PDF |
| Executive Diagnostic | **$6,500** | Facilitated review + PDF |

### P2 — Governance Entropy Workbook™

| Tier | Price (CAD) | Delivery |
|---|---|---|
| Workbook — Self-Guided | **$2,400** | Self-serve checkout, six-module flow + PDF export |
| Workbook — Facilitated Institutional Edition | **$8,500** | Facilitated mapping, all six modules unlocked |
| Workbook — Enterprise Continuity Mapping | **$18,000 – $45,000** | Sales-led engagement |

### P3 — OCI Diagnostic, P4 — Runtime, P5 — Intelligence Network

Pricing is architectural in this document; commercialization is captured
separately when each layer becomes a shipping product.

## P5 architectural reservation — Institutional benchmarking

P5 is the OCI Intelligence Network. Once a sufficient number of institutions
complete ICRA and Workbook engagements, the network produces:

- anonymized maturity comparisons across sectors and jurisdictions,
- continuity survivability baselines,
- sector-specific stewardship burden norms,
- governance entropy distributions per institutional size band,
- modernization-alignment patterns over time.

**Constraint (canonical):** All P5 outputs are aggregates. No per-institution
identification, no per-holder data, no behavioral profiling. The anti-
surveillance posture that anchors P1 and P2 holds at the network layer.

**Forward-compatibility hooks landed today** (so future benchmarking does not
require retroactive consent re-collection):

- `workbooks.sectorBand` (text, nullable, voluntarily provided)
- `workbooks.institutionSizeBand` (text, nullable, voluntarily provided)
- Schema topology doctrine: all OCI tables must remain aggregable without
  re-identification (see [canonical-schema-topology.md](../categories/platform-and-operations/architecture/orm-governance/canonical-schema-topology.md)).

## Signature IP frameworks

The OCI doctrine is anchored by five named, trademarked frameworks. They are
implemented in code under `apps/union-eyes/lib/oci/frameworks/` and referenced
from product surfaces, PDF exports, and CRM intelligence.

| Framework | Purpose |
|---|---|
| **Continuity Burden Map™** | Identifies and weights the invisible continuity burden a few people are absorbing on behalf of the institution. |
| **Governance Entropy Scale™** | A five-point scale measuring drift between governance design and governance practice. |
| **Stewardship Density Index™** | Quantifies how concentrated institutional knowledge is in too few continuity carriers. |
| **Continuity Survivability Matrix™** | Plots institutional dependencies against successor identification to surface survivability gaps. |
| **Reconstruction Burden Index™** | Estimates the cost of reconstructing institutional knowledge after a continuity break. |

## Voice and brand constraints

- Calm, editorial, governance-native. Never urgent, never gamified, never
  productivity-coded.
- Stone palette only on web (`stone-50` through `stone-900`). Poppins
  (sans) only. PDF uses Times (serif) headings + Helvetica (sans) body.
- Forbidden: gradients, dashboard energy, kanban, AI-futurism, collaboration
  metaphors, productivity vocabulary, urgency tactics.
- Anti-surveillance: only deterministic, voluntarily-provided data leaves the
  database. Holder names and notes never sync to CRM or PDF aggregates.

## Cross-references

- [OCI Method™](./oci-method.md) — the methodology spine
- [Canonical schema topology](../categories/platform-and-operations/architecture/orm-governance/canonical-schema-topology.md) — Drizzle scope governance
- [`apps/union-eyes/lib/oci/frameworks/`](../../apps/union-eyes/lib/oci/frameworks/) — framework implementations
